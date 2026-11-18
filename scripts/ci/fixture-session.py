"""Obtain a session from a loopback migration fixture using the BFF protocol."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def dump(value):
    return json.dumps(value, separators=(",", ":")).encode()


def main(port, login):
    if not port.isdigit() or not 0 < int(port) < 65536 or login not in ("admin-local", "kr-0001"):
        raise ValueError("Expected an isolated fixture port and documented fixture login")
    origin = f"http://127.0.0.1:{port}"
    client = build_opener(NoRedirect())
    with client.open(origin + "/api/v1/health", timeout=10) as response:
        health = json.load(response)
        if health.get("environment") != "rust-parity":
            raise ValueError("Expected a Rust migration fixture")
    path = "/api/v1/auth/login"
    body = dump({"enter_cd":"VIBE", "login_id":login, "password":"admin"})
    source = hashlib.sha256(secrets.token_bytes(32)).digest()
    now = int(time.time())
    header = encode(dump({"alg":"HS256","typ":"VIBEHR-BFF"}))
    claims = encode(dump({"ver":1,"method":"POST","path":path,"iat":now,"exp":now+30,
        "nonce":secrets.token_urlsafe(32),"purpose":"login","body_sha256":encode(hashlib.sha256(body).digest()),
        "source_hash":encode(source),"replay_bucket":source[0],"client_id":secrets.token_urlsafe(32),
        "request_binding":encode(hashlib.sha256(("VIBE\0"+login).encode()).digest())}))
    signed = header + "." + claims
    sig = encode(hmac.digest(os.environ["VIBEHR_BFF_ASSERTION_SECRET"].encode(), signed.encode(), "sha256"))
    request = Request(origin+path, method="POST", data=body,
        headers={"Content-Type":"application/json","X-VibeHR-BFF-Assertion":signed+"."+sig})
    with client.open(request, timeout=20) as response:
        result=json.load(response)
        expected="admin@vibe-hr.local" if login=="admin-local" else "kr-0001@vibe-hr.local"
        if result["user"]["email"] != expected or (login=="admin-local") != ("admin" in result["user"]["roles"]):
            raise ValueError("Unexpected fixture principal")
        print(result["access_token"])


if __name__=="__main__":
    main(*sys.argv[1:])
