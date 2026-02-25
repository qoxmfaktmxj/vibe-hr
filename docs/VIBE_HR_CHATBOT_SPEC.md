# Vibe-HR 전용 챗봇 개발 명세서 (v1)

## 1. 목적
Vibe-HR 내부에서 사용자(석)가 자연어로 요청하면, 코드 분석/수정 제안/테스트/커밋/푸시(PR)까지 안전하게 실행하는 **개발 보조 챗봇**을 제공한다.

## 2. 핵심 요구사항
1. 채팅 UI + 세션 이력 저장
2. 코드 변경은 항상 Diff 기반 제안
3. 승인 후에만 파일 적용/커밋/푸시
4. 작업 브랜치 제한: `dev/agent-*`
5. main 직접 푸시 금지

## 3. 아키텍처
- Frontend: Vibe-HR 내 채팅 패널(우측 Drawer)
- BFF(Next API): 인증 쿠키 전달/검증
- Agent Backend(FastAPI):
  - 프롬프트 오케스트레이션
  - 파일 읽기/쓰기 정책 집행
  - 테스트 실행
  - git commit/push/PR 생성

## 4. 권한 모델
- `chat.read`: 대화 조회
- `chat.write`: 질문 전송
- `code.propose`: 변경안 생성
- `code.apply`: 변경 적용
- `git.commit`: 커밋 수행
- `git.push`: 원격 푸시

운영 권장:
- 일반사용자: `chat.*`, `code.propose`
- 승인권자: `code.apply`, `git.commit`, `git.push`

## 5. 저장 모델
### 5.1 chat_sessions
- id, created_by, title, branch_name, status, created_at, updated_at

### 5.2 chat_messages
- id, session_id, role(user/assistant/system), content, meta_json, created_at

### 5.3 chat_actions
- id, session_id, action_type(edit/test/commit/push),
- request_json, result_json, status, started_at, finished_at

## 6. API 명세(요약)
- `POST /api/v1/chat/sessions`
- `GET /api/v1/chat/sessions/{id}`
- `POST /api/v1/chat/sessions/{id}/messages`
- `POST /api/v1/chat/sessions/{id}/propose`
- `POST /api/v1/chat/sessions/{id}/apply`
- `POST /api/v1/chat/sessions/{id}/test`
- `POST /api/v1/chat/sessions/{id}/commit`
- `POST /api/v1/chat/sessions/{id}/push`

## 7. Git 운영 정책
1. 세션 시작 시 `dev/agent-{date}-{slug}` 브랜치 생성
2. 변경 전 자동 스냅샷(restore point)
3. 커밋 템플릿 강제:
   - `feat(scope): summary`
   - 본문: 변경 파일/테스트/리스크
4. push 후 PR 자동 생성 링크 반환

## 8. 보안/안전 정책
- 허용 경로 화이트리스트
  - `frontend/src/**`
  - `backend/app/**`
  - `docs/**`
- 금지 작업
  - 시스템 파일 접근(`/etc`, `/root/.ssh`)
  - 비밀키 출력
  - `rm -rf`, 권한승격 명령
- 모든 파괴적 동작은 사용자 승인 2단계

## 9. 실행 플로우
1. 사용자 질문
2. 컨텍스트 수집(열린 파일, 최근 커밋, 현재 브랜치)
3. 변경안 생성(diff)
4. 사용자 승인
5. 적용 + 테스트
6. 커밋/푸시 + PR 링크 전달

## 10. UI 요구사항
- 우측 채팅 패널 Drawer
- 탭: `대화`, `변경 Diff`, `실행 로그`
- 버튼: `변경 제안`, `적용`, `테스트`, `커밋`, `푸시`
- 위험 액션은 확인 모달 필수

## 11. 테스트 전략
- 단위: 권한/검증/브랜치 정책
- 통합: propose→apply→test→commit→push E2E
- 회귀: 기존 HR/TIM 화면 라우팅 영향 점검

## 12. 배포 전략
- 1단계: read/propose only (적용 불가)
- 2단계: apply + test
- 3단계: commit + push + PR 자동화

## 13. 운영 KPI
- 제안→적용 승인율
- 테스트 통과율
- PR 생성 소요시간
- 롤백 발생률
