from app.api.hri_request import router


def test_my_requests_route_is_registered_before_dynamic_request_detail() -> None:
    paths = [route.path for route in router.routes]

    assert "/hri/requests/my" in paths
    assert "/hri/requests/{request_id}" in paths
    assert paths.index("/hri/requests/my") < paths.index("/hri/requests/{request_id}")
