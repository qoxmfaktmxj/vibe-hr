--
-- PostgreSQL database dump
--

\restrict BhML4YvMFOdCVX0mUNK8E4nZZSEwISDevHfcTf3YjkTP3haAQBFDj3wYKnYNSq6

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: PAP_FINAL_RESULTS; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."PAP_FINAL_RESULTS" VALUES (1, 'S', 'Outstanding', 100, true, 10, 'Top performance', '2026-08-01 04:38:06.841777', '2026-08-01 04:38:06.841777');
INSERT INTO public."PAP_FINAL_RESULTS" VALUES (2, 'A', 'Exceeds Expectations', 90, true, 20, 'High performance', '2026-08-01 04:38:06.843775', '2026-08-01 04:38:06.843775');
INSERT INTO public."PAP_FINAL_RESULTS" VALUES (3, 'B', 'Meets Expectations', 80, true, 30, 'Normal performance', '2026-08-01 04:38:06.844776', '2026-08-01 04:38:06.844776');
INSERT INTO public."PAP_FINAL_RESULTS" VALUES (4, 'C', 'Needs Improvement', 70, true, 40, 'Improvement required', '2026-08-01 04:38:06.846776', '2026-08-01 04:38:06.846776');


--
-- Data for Name: PAP_APPRAISAL_MASTERS; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."PAP_APPRAISAL_MASTERS" VALUES (1, 'ANNUAL_2026', '2026 Annual Appraisal', 2026, 2, 'annual', '2026-01-01', '2026-12-31', true, 10, 'Temporary seed for PAP module', '2026-08-01 04:38:06.852295', '2026-08-01 04:38:06.852295');
INSERT INTO public."PAP_APPRAISAL_MASTERS" VALUES (2, 'H1_2026', '2026 H1 Appraisal', 2026, 3, 'half_year', '2026-01-01', '2026-06-30', true, 20, 'Temporary seed for PAP module', '2026-08-01 04:38:06.854589', '2026-08-01 04:38:06.854589');


--
-- Data for Name: app_code_groups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_code_groups VALUES (1, 'ORG_MAPPING_TYPE', '조직매핑유형', '조직 매핑 유형', true, 7, '2026-08-01 04:38:06.576126', '2026-08-01 04:38:06.576126');
INSERT INTO public.app_code_groups VALUES (2, 'POSITION', '직위', '직위 구분', true, 1, '2026-08-01 04:38:06.586143', '2026-08-01 04:38:06.586143');
INSERT INTO public.app_code_groups VALUES (3, 'RANK', '직급', '직급 구분', true, 2, '2026-08-01 04:38:06.590009', '2026-08-01 04:38:06.590009');
INSERT INTO public.app_code_groups VALUES (4, 'JOB_GROUP', '직군', '직군 구분', true, 3, '2026-08-01 04:38:06.592597', '2026-08-01 04:38:06.592597');
INSERT INTO public.app_code_groups VALUES (5, 'SALARY_TYPE', '연봉타입', '연봉 유형', true, 4, '2026-08-01 04:38:06.597708', '2026-08-01 04:38:06.597708');
INSERT INTO public.app_code_groups VALUES (6, 'ORG_TYPE', '조직유형', '조직 유형 구분', true, 5, '2026-08-01 04:38:06.601708', '2026-08-01 04:38:06.601708');
INSERT INTO public.app_code_groups VALUES (7, 'EMPLOYMENT_STATUS', '재직상태', '재직/휴직/퇴직 구분', true, 6, '2026-08-01 04:38:06.606239', '2026-08-01 04:38:06.606239');
INSERT INTO public.app_code_groups VALUES (8, 'MNG_DEV_STATUS', '개발진행상태', '추가개발 진행상태 구분', true, 100, '2026-08-01 04:38:06.60926', '2026-08-01 04:38:06.60926');
INSERT INTO public.app_code_groups VALUES (9, 'MNG_PART', '파트구분', '개발 파트 구분', true, 101, '2026-08-01 04:38:06.612548', '2026-08-01 04:38:06.612548');
INSERT INTO public.app_code_groups VALUES (10, 'MNG_APPROVAL_STATUS', '승인상태', '승인/반려 상태 구분', true, 102, '2026-08-01 04:38:06.616546', '2026-08-01 04:38:06.616546');
INSERT INTO public.app_code_groups VALUES (11, 'MNG_ATTEND_TYPE', '외주근태종류', '외주인력 근태 종류', true, 103, '2026-08-01 04:38:06.620078', '2026-08-01 04:38:06.620078');
INSERT INTO public.app_code_groups VALUES (12, 'MNG_ATTEND_STATUS', '외주근태상태', '외주인력 근태 상태', true, 104, '2026-08-01 04:38:06.623102', '2026-08-01 04:38:06.623102');
INSERT INTO public.app_code_groups VALUES (13, 'MNG_INQUIRY_STATUS', '문의진행상태', '추가개발 문의 진행상태', true, 105, '2026-08-01 04:38:06.626445', '2026-08-01 04:38:06.626445');
INSERT INTO public.app_code_groups VALUES (14, 'MNG_INSPECTION', '검수상태', '검수 완료 여부', true, 106, '2026-08-01 04:38:06.630472', '2026-08-01 04:38:06.630472');
INSERT INTO public.app_code_groups VALUES (15, 'MNG_SERVICE_TYPE', '서비스구분', '인프라 서비스 구분', true, 107, '2026-08-01 04:38:06.634061', '2026-08-01 04:38:06.634061');
INSERT INTO public.app_code_groups VALUES (16, 'HR_APPOINTMENT_CODE', '발령코드', '발령처리 코드', true, 120, '2026-08-01 04:38:06.637063', '2026-08-01 04:38:06.637063');


--
-- Data for Name: app_codes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_codes VALUES (1, 2, '01', '사원', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.645356', '2026-08-01 04:38:06.645356');
INSERT INTO public.app_codes VALUES (2, 2, '02', '대리', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.650355', '2026-08-01 04:38:06.650355');
INSERT INTO public.app_codes VALUES (3, 2, '03', '과장', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.654804', '2026-08-01 04:38:06.654804');
INSERT INTO public.app_codes VALUES (4, 2, '04', '차장', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.659207', '2026-08-01 04:38:06.659207');
INSERT INTO public.app_codes VALUES (5, 2, '05', '부장', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.663664', '2026-08-01 04:38:06.663664');
INSERT INTO public.app_codes VALUES (6, 2, '06', '이사', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.667849', '2026-08-01 04:38:06.667849');
INSERT INTO public.app_codes VALUES (7, 7, 'active', '재직', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.671851', '2026-08-01 04:38:06.671851');
INSERT INTO public.app_codes VALUES (8, 7, 'leave', '휴직', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.675837', '2026-08-01 04:38:06.675837');
INSERT INTO public.app_codes VALUES (9, 7, 'resigned', '퇴직', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.678885', '2026-08-01 04:38:06.678885');
INSERT INTO public.app_codes VALUES (10, 8, '접수', '접수', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.682692', '2026-08-01 04:38:06.682692');
INSERT INTO public.app_codes VALUES (11, 8, '검토', '검토', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.687074', '2026-08-01 04:38:06.687074');
INSERT INTO public.app_codes VALUES (12, 8, '진행', '진행중', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.69029', '2026-08-01 04:38:06.69029');
INSERT INTO public.app_codes VALUES (13, 8, '완료', '완료', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.693311', '2026-08-01 04:38:06.693311');
INSERT INTO public.app_codes VALUES (14, 8, '보류', '보류', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.69642', '2026-08-01 04:38:06.697418');
INSERT INTO public.app_codes VALUES (15, 8, '취소', '취소', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.700445', '2026-08-01 04:38:06.700445');
INSERT INTO public.app_codes VALUES (16, 9, 'SI', 'SI파트', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.703953', '2026-08-01 04:38:06.703953');
INSERT INTO public.app_codes VALUES (17, 9, 'SM', 'SM파트', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.70698', '2026-08-01 04:38:06.70698');
INSERT INTO public.app_codes VALUES (18, 9, 'SOL', '솔루션파트', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.710605', '2026-08-01 04:38:06.710605');
INSERT INTO public.app_codes VALUES (19, 9, 'INFRA', '인프라파트', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.713605', '2026-08-01 04:38:06.713605');
INSERT INTO public.app_codes VALUES (20, 10, '신청', '신청', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.717197', '2026-08-01 04:38:06.717197');
INSERT INTO public.app_codes VALUES (21, 10, '승인', '승인', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.720238', '2026-08-01 04:38:06.720238');
INSERT INTO public.app_codes VALUES (22, 10, '반려', '반려', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.72502', '2026-08-01 04:38:06.72502');
INSERT INTO public.app_codes VALUES (23, 11, '연차', '연차', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.728037', '2026-08-01 04:38:06.728037');
INSERT INTO public.app_codes VALUES (24, 11, '반차', '반차(오전)', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.731781', '2026-08-01 04:38:06.731781');
INSERT INTO public.app_codes VALUES (25, 11, '반차PM', '반차(오후)', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.736592', '2026-08-01 04:38:06.736592');
INSERT INTO public.app_codes VALUES (26, 11, '병가', '병가', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.740592', '2026-08-01 04:38:06.740592');
INSERT INTO public.app_codes VALUES (27, 11, '경조', '경조휴가', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.743515', '2026-08-01 04:38:06.743515');
INSERT INTO public.app_codes VALUES (28, 11, '기타', '기타', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.747058', '2026-08-01 04:38:06.747058');
INSERT INTO public.app_codes VALUES (29, 12, '신청', '신청', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.751058', '2026-08-01 04:38:06.751058');
INSERT INTO public.app_codes VALUES (30, 12, '승인', '승인', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.754058', '2026-08-01 04:38:06.754058');
INSERT INTO public.app_codes VALUES (31, 12, '반려', '반려', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.757657', '2026-08-01 04:38:06.757657');
INSERT INTO public.app_codes VALUES (32, 13, '접수', '접수', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.760246', '2026-08-01 04:38:06.760246');
INSERT INTO public.app_codes VALUES (33, 13, '검토', '검토중', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.764043', '2026-08-01 04:38:06.764043');
INSERT INTO public.app_codes VALUES (34, 13, '견적', '견적진행', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.767559', '2026-08-01 04:38:06.767559');
INSERT INTO public.app_codes VALUES (35, 13, '확정', '확정', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.770234', '2026-08-01 04:38:06.770234');
INSERT INTO public.app_codes VALUES (36, 13, '보류', '보류', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.773234', '2026-08-01 04:38:06.773234');
INSERT INTO public.app_codes VALUES (37, 13, '취소', '취소', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.776277', '2026-08-01 04:38:06.776277');
INSERT INTO public.app_codes VALUES (38, 14, '미검수', '미검수', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.779757', '2026-08-01 04:38:06.779757');
INSERT INTO public.app_codes VALUES (39, 14, '검수완료', '검수완료', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.78379', '2026-08-01 04:38:06.78379');
INSERT INTO public.app_codes VALUES (40, 15, 'ERP', 'ERP', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.787264', '2026-08-01 04:38:06.787264');
INSERT INTO public.app_codes VALUES (41, 15, 'MES', 'MES', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.790303', '2026-08-01 04:38:06.790303');
INSERT INTO public.app_codes VALUES (42, 15, 'WMS', 'WMS', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.793072', '2026-08-01 04:38:06.793072');
INSERT INTO public.app_codes VALUES (43, 15, 'GROUPWARE', '그룹웨어', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.796651', '2026-08-01 04:38:06.796651');
INSERT INTO public.app_codes VALUES (44, 15, 'PORTAL', '포털', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.800102', '2026-08-01 04:38:06.800102');
INSERT INTO public.app_codes VALUES (45, 15, 'ETC', '기타', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.803101', '2026-08-01 04:38:06.803101');
INSERT INTO public.app_codes VALUES (46, 16, 'NEW_HIRE', '신규채용', NULL, true, 1, NULL, NULL, '2026-08-01 04:38:06.806959', '2026-08-01 04:38:06.806959');
INSERT INTO public.app_codes VALUES (47, 16, 'CAREER_HIRE', '경력채용', NULL, true, 2, NULL, NULL, '2026-08-01 04:38:06.809959', '2026-08-01 04:38:06.809959');
INSERT INTO public.app_codes VALUES (48, 16, 'RESIGNATION', '퇴사', NULL, true, 3, NULL, NULL, '2026-08-01 04:38:06.813973', '2026-08-01 04:38:06.813973');
INSERT INTO public.app_codes VALUES (49, 16, 'JOB_FAMILY_CHANGE', '직군변경', NULL, true, 4, NULL, NULL, '2026-08-01 04:38:06.81697', '2026-08-01 04:38:06.81697');
INSERT INTO public.app_codes VALUES (50, 16, 'DEPT_TRANSFER', '부서이동', NULL, true, 5, NULL, NULL, '2026-08-01 04:38:06.819887', '2026-08-01 04:38:06.819887');
INSERT INTO public.app_codes VALUES (51, 16, 'SUSPENSION', '정직', NULL, true, 6, NULL, NULL, '2026-08-01 04:38:06.823886', '2026-08-01 04:38:06.823886');
INSERT INTO public.app_codes VALUES (52, 16, 'LEAVE_OF_ABSENCE', '휴직', NULL, true, 7, NULL, NULL, '2026-08-01 04:38:06.827928', '2026-08-01 04:38:06.827928');
INSERT INTO public.app_codes VALUES (53, 16, 'PROMOTION', '승진', NULL, true, 8, NULL, NULL, '2026-08-01 04:38:06.830928', '2026-08-01 04:38:06.830928');
INSERT INTO public.app_codes VALUES (54, 16, 'DEMOTION', '강등', NULL, true, 9, NULL, NULL, '2026-08-01 04:38:06.833742', '2026-08-01 04:38:06.833742');
INSERT INTO public.app_codes VALUES (55, 16, 'REINSTATEMENT', '복직', NULL, true, 10, NULL, NULL, '2026-08-01 04:38:06.837742', '2026-08-01 04:38:06.837742');


--
-- Data for Name: app_menus; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_menus VALUES (1, 'dashboard', '대시보드', NULL, '/dashboard', 'LayoutDashboard', 100, true, '2026-08-01 04:38:00.290622', '2026-08-01 04:38:00.290622');
INSERT INTO public.app_menus VALUES (2, 'hr', '인사', NULL, NULL, 'UsersRound', 200, true, '2026-08-01 04:38:00.352071', '2026-08-01 04:38:00.352071');
INSERT INTO public.app_menus VALUES (3, 'hr.info', '인사정보', 2, NULL, 'UserRound', 201, true, '2026-08-01 04:38:00.423407', '2026-08-01 04:38:00.423407');
INSERT INTO public.app_menus VALUES (4, 'hr.basic', '인사기본', 3, '/hr/basic', 'UserRound', 202, true, '2026-08-01 04:38:00.481314', '2026-08-01 04:38:00.481314');
INSERT INTO public.app_menus VALUES (5, 'hr.employee', '사원관리', 3, '/hr/employee', 'UserRound', 203, true, '2026-08-01 04:38:00.540618', '2026-08-01 04:38:00.540618');
INSERT INTO public.app_menus VALUES (6, 'hr.recruit', '채용관리', 2, NULL, 'UserRound', 204, true, '2026-08-01 04:38:00.601543', '2026-08-01 04:38:00.601543');
INSERT INTO public.app_menus VALUES (7, 'hr.recruit.finalists', '채용합격자등록', 6, '/hr/recruit/finalists', 'UserRound', 205, true, '2026-08-01 04:38:00.660623', '2026-08-01 04:38:00.660623');
INSERT INTO public.app_menus VALUES (8, 'hr.appointment', '발령관리', 2, NULL, 'FileText', 210, true, '2026-08-01 04:38:00.737039', '2026-08-01 04:38:00.737039');
INSERT INTO public.app_menus VALUES (9, 'hr.appointment.codes', '발령코드관리', 8, '/hr/appointment/codes', 'ListOrdered', 211, true, '2026-08-01 04:38:00.788992', '2026-08-01 04:38:00.788992');
INSERT INTO public.app_menus VALUES (10, 'hr.appointment.records', '발령처리관리', 8, '/hr/appointment/records', 'UserRound', 212, true, '2026-08-01 04:38:00.839556', '2026-08-01 04:38:00.839556');
INSERT INTO public.app_menus VALUES (11, 'hr.admin', '인사관리', 2, NULL, 'UsersRound', 220, true, '2026-08-01 04:38:00.890035', '2026-08-01 04:38:00.890035');
INSERT INTO public.app_menus VALUES (12, 'hr.admin.rewards', '상벌관리', 11, '/hr/admin/rewards', 'UserRound', 221, true, '2026-08-01 04:38:00.939881', '2026-08-01 04:38:00.939881');
INSERT INTO public.app_menus VALUES (13, 'hr.admin.contacts', '주소연락처관리', 11, '/hr/admin/contacts', 'UserRound', 222, true, '2026-08-01 04:38:00.989385', '2026-08-01 04:38:00.989385');
INSERT INTO public.app_menus VALUES (14, 'hr.admin.educations', '학력관리', 11, '/hr/admin/educations', 'UserRound', 223, true, '2026-08-01 04:38:01.04884', '2026-08-01 04:38:01.049841');
INSERT INTO public.app_menus VALUES (15, 'hr.admin.careers', '경력관리', 11, '/hr/admin/careers', 'UserRound', 224, true, '2026-08-01 04:38:01.099871', '2026-08-01 04:38:01.099871');
INSERT INTO public.app_menus VALUES (16, 'hr.admin.certificates', '자격증관리', 11, '/hr/admin/certificates', 'UserRound', 225, true, '2026-08-01 04:38:01.150144', '2026-08-01 04:38:01.150144');
INSERT INTO public.app_menus VALUES (17, 'hr.admin.military', '병역관리', 11, '/hr/admin/military', 'UserRound', 226, true, '2026-08-01 04:38:01.216652', '2026-08-01 04:38:01.216652');
INSERT INTO public.app_menus VALUES (18, 'hr.admin.evaluations', '인사평가관리', 11, '/hr/admin/evaluations', 'UserRound', 227, true, '2026-08-01 04:38:01.269242', '2026-08-01 04:38:01.269242');
INSERT INTO public.app_menus VALUES (19, 'hr.retire', '퇴직관리', 2, NULL, 'FileText', 230, true, '2026-08-01 04:38:01.320136', '2026-08-01 04:38:01.320136');
INSERT INTO public.app_menus VALUES (20, 'hr.retire.checklist', '퇴직체크리스트', 19, '/hr/retire/checklist', 'ListOrdered', 231, true, '2026-08-01 04:38:01.370322', '2026-08-01 04:38:01.370322');
INSERT INTO public.app_menus VALUES (21, 'hr.retire.approvals', '퇴직승인관리', 19, '/hr/retire/approvals', 'FileText', 232, true, '2026-08-01 04:38:01.430372', '2026-08-01 04:38:01.430372');
INSERT INTO public.app_menus VALUES (22, 'hr.severance.calcs', '퇴직금산정', 19, '/hr/severance/calcs', 'Calculator', 233, true, '2026-08-01 04:38:01.5205', '2026-08-01 04:38:01.5205');
INSERT INTO public.app_menus VALUES (23, 'pap', '성과관리', NULL, NULL, 'FileText', 250, true, '2026-08-01 04:38:01.579598', '2026-08-01 04:38:01.579598');
INSERT INTO public.app_menus VALUES (24, 'pap.appraisals', '평가기준관리', 23, '/pap/appraisals', 'ListOrdered', 251, true, '2026-08-01 04:38:01.640573', '2026-08-01 04:38:01.640573');
INSERT INTO public.app_menus VALUES (25, 'pap.final-results', '최종등급관리', 23, '/pap/final-results', 'Award', 252, true, '2026-08-01 04:38:01.704045', '2026-08-01 04:38:01.704045');
INSERT INTO public.app_menus VALUES (26, 'pap.targets', '평가 대상자 관리', 23, '/pap/targets', 'Users', 253, true, '2026-08-01 04:38:01.760637', '2026-08-01 04:38:01.760637');
INSERT INTO public.app_menus VALUES (27, 'org', '조직', NULL, NULL, 'Building2', 300, true, '2026-08-01 04:38:01.8191', '2026-08-01 04:38:01.8191');
INSERT INTO public.app_menus VALUES (28, 'org.manage', '조직관리', 27, NULL, 'FolderTree', 301, true, '2026-08-01 04:38:01.879322', '2026-08-01 04:38:01.879322');
INSERT INTO public.app_menus VALUES (29, 'org.corporations', '법인관리', 28, '/org/corporations', 'Building2', 302, true, '2026-08-01 04:38:01.929282', '2026-08-01 04:38:01.929282');
INSERT INTO public.app_menus VALUES (30, 'org.departments', '조직코드관리', 28, '/org/departments', 'FolderTree', 303, true, '2026-08-01 04:38:01.991709', '2026-08-01 04:38:01.991709');
INSERT INTO public.app_menus VALUES (31, 'org.chart', '조직도관리', 28, '/org/chart', 'FolderTree', 304, true, '2026-08-01 04:38:02.050882', '2026-08-01 04:38:02.050882');
INSERT INTO public.app_menus VALUES (32, 'org.types', '조직구분', 28, '/org/types', 'FolderTree', 305, true, '2026-08-01 04:38:02.109241', '2026-08-01 04:38:02.109241');
INSERT INTO public.app_menus VALUES (33, 'org.type-items', '조직구분항목', 28, '/org/type-items', 'FolderTree', 306, true, '2026-08-01 04:38:02.170208', '2026-08-01 04:38:02.170208');
INSERT INTO public.app_menus VALUES (34, 'org.type-upload', '조직구분업로드', 28, '/org/type-upload', 'FolderTree', 307, true, '2026-08-01 04:38:02.2304', '2026-08-01 04:38:02.2304');
INSERT INTO public.app_menus VALUES (35, 'org.type-personal-status', '조직구분개인별현황', 28, '/org/type-personal-status', 'FolderTree', 308, true, '2026-08-01 04:38:02.28937', '2026-08-01 04:38:02.28937');
INSERT INTO public.app_menus VALUES (36, 'org.restructure', '조직개편안관리', 28, '/org/restructure', 'GitMerge', 309, true, '2026-08-01 04:38:02.350572', '2026-08-01 04:38:02.350572');
INSERT INTO public.app_menus VALUES (37, 'org.dept-history', '부서변경이력', 28, '/org/dept-history', 'History', 310, true, '2026-08-01 04:38:02.40937', '2026-08-01 04:38:02.40937');
INSERT INTO public.app_menus VALUES (38, 'tim', '근태', NULL, NULL, 'Clock', 400, true, '2026-08-01 04:38:02.469753', '2026-08-01 04:38:02.469753');
INSERT INTO public.app_menus VALUES (39, 'tim.base', '근태기준관리', 38, NULL, 'CalendarCheck2', 401, true, '2026-08-01 04:38:02.529972', '2026-08-01 04:38:02.529972');
INSERT INTO public.app_menus VALUES (40, 'tim.holidays', '공휴일관리', 39, '/tim/holidays', 'CalendarDays', 402, true, '2026-08-01 04:38:02.589111', '2026-08-01 04:38:02.589111');
INSERT INTO public.app_menus VALUES (41, 'tim.codes', '근태코드관리', 39, '/tim/codes', 'CalendarCheck2', 403, true, '2026-08-01 04:38:02.640056', '2026-08-01 04:38:02.640056');
INSERT INTO public.app_menus VALUES (42, 'tim.work-codes', '근무코드관리', 39, '/tim/work-codes', 'Clock', 404, true, '2026-08-01 04:38:02.698547', '2026-08-01 04:38:02.698547');
INSERT INTO public.app_menus VALUES (43, 'tim.daily', '일상근태', 38, NULL, 'Clock', 410, true, '2026-08-01 04:38:02.749604', '2026-08-01 04:38:02.749628');
INSERT INTO public.app_menus VALUES (44, 'tim.check-in', '출퇴근기록', 43, '/tim/check-in', 'CalendarCheck2', 411, true, '2026-08-01 04:38:02.805108', '2026-08-01 04:38:02.805108');
INSERT INTO public.app_menus VALUES (45, 'tim.status', '근태현황', 43, '/tim/status', 'ListOrdered', 412, true, '2026-08-01 04:38:02.869636', '2026-08-01 04:38:02.869636');
INSERT INTO public.app_menus VALUES (46, 'tim.correction', '근태수정', 43, '/tim/correction', 'CalendarDays', 413, true, '2026-08-01 04:38:02.919252', '2026-08-01 04:38:02.919252');
INSERT INTO public.app_menus VALUES (47, 'tim.leave', '휴가관리', 38, NULL, 'CalendarDays', 420, true, '2026-08-01 04:38:02.96947', '2026-08-01 04:38:02.96947');
INSERT INTO public.app_menus VALUES (48, 'tim.annual-leave', '연차관리', 47, '/tim/annual-leave', 'CalendarDays', 421, true, '2026-08-01 04:38:03.030138', '2026-08-01 04:38:03.030138');
INSERT INTO public.app_menus VALUES (49, 'tim.leave-request', '휴가신청', 47, '/tim/leave-request', 'CalendarCheck2', 422, true, '2026-08-01 04:38:03.07912', '2026-08-01 04:38:03.07912');
INSERT INTO public.app_menus VALUES (50, 'tim.leave-approval', '휴가승인', 47, '/tim/leave-approval', 'ListOrdered', 423, true, '2026-08-01 04:38:03.135213', '2026-08-01 04:38:03.135213');
INSERT INTO public.app_menus VALUES (51, 'tim.month-close', '근태월마감', 47, '/tim/month-close', 'CalendarOff', 424, true, '2026-08-01 04:38:03.189065', '2026-08-01 04:38:03.190067');
INSERT INTO public.app_menus VALUES (52, 'tim.reports', '근태리포트', 38, '/tim/reports', 'FileText', 430, true, '2026-08-01 04:38:03.260493', '2026-08-01 04:38:03.260493');
INSERT INTO public.app_menus VALUES (53, 'tim.month-closing', '월마감', 38, '/tim/month-closing', 'CalendarX', 431, true, '2026-08-01 04:38:03.309189', '2026-08-01 04:38:03.309189');
INSERT INTO public.app_menus VALUES (54, 'hri', '신청서', NULL, NULL, 'FileText', 450, true, '2026-08-01 04:38:03.358693', '2026-08-01 04:38:03.358693');
INSERT INTO public.app_menus VALUES (55, 'hri.requests', '내 문서', 54, NULL, 'ListOrdered', 451, true, '2026-08-01 04:38:03.419938', '2026-08-01 04:38:03.419938');
INSERT INTO public.app_menus VALUES (56, 'hri.requests.mine', '내 신청서', 55, '/hri/requests/mine', 'FileText', 452, true, '2026-08-01 04:38:03.4804', '2026-08-01 04:38:03.4804');
INSERT INTO public.app_menus VALUES (57, 'hri.tasks.approvals', '결재함', 55, '/hri/tasks/approvals', 'ListOrdered', 453, true, '2026-08-01 04:38:03.551879', '2026-08-01 04:38:03.551879');
INSERT INTO public.app_menus VALUES (58, 'hri.tasks.receives', '수신함', 55, '/hri/tasks/receives', 'ListOrdered', 454, true, '2026-08-01 04:38:03.621759', '2026-08-01 04:38:03.621759');
INSERT INTO public.app_menus VALUES (59, 'hri.my-payslip', '내 급여조회', 54, '/hri/my-payslip', 'Receipt', 455, true, '2026-08-01 04:38:03.688872', '2026-08-01 04:38:03.688872');
INSERT INTO public.app_menus VALUES (60, 'hri.admin', '신청서관리', 54, NULL, 'Settings', 460, true, '2026-08-01 04:38:03.761635', '2026-08-01 04:38:03.761635');
INSERT INTO public.app_menus VALUES (61, 'hri.admin.form-types', '신청서코드관리', 60, '/hri/admin/form-types', 'ListOrdered', 461, true, '2026-08-01 04:38:03.820562', '2026-08-01 04:38:03.820562');
INSERT INTO public.app_menus VALUES (62, 'hri.admin.approval-lines', '결재선관리', 60, '/hri/admin/approval-lines', 'ListOrdered', 462, true, '2026-08-01 04:38:03.880337', '2026-08-01 04:38:03.880337');
INSERT INTO public.app_menus VALUES (63, 'payroll', '급여', NULL, NULL, 'Wallet', 500, true, '2026-08-01 04:38:03.939142', '2026-08-01 04:38:03.939142');
INSERT INTO public.app_menus VALUES (64, 'payroll.base', '급여기준관리', 63, NULL, 'Calculator', 501, true, '2026-08-01 04:38:04.000246', '2026-08-01 04:38:04.000246');
INSERT INTO public.app_menus VALUES (65, 'payroll.allowance-deduction-items', '수당공제항목관리', 64, '/payroll/allowance-deduction-items', 'Calculator', 502, true, '2026-08-01 04:38:04.059802', '2026-08-01 04:38:04.059802');
INSERT INTO public.app_menus VALUES (66, 'payroll.item-groups', '항목그룹관리', 64, '/payroll/item-groups', 'Calculator', 503, true, '2026-08-01 04:38:04.122408', '2026-08-01 04:38:04.122408');
INSERT INTO public.app_menus VALUES (67, 'payroll.codes', '급여코드관리', 64, '/payroll/codes', 'Calculator', 504, true, '2026-08-01 04:38:04.181743', '2026-08-01 04:38:04.181743');
INSERT INTO public.app_menus VALUES (68, 'payroll.tax-rates', '세율및사회보험관리', 64, '/payroll/tax-rates', 'Calculator', 505, true, '2026-08-01 04:38:04.239988', '2026-08-01 04:38:04.239988');
INSERT INTO public.app_menus VALUES (69, 'payroll.income-tax-brackets', '소득세구간관리', 64, '/payroll/income-tax-brackets', 'Calculator', 506, true, '2026-08-01 04:38:04.300165', '2026-08-01 04:38:04.300165');
INSERT INTO public.app_menus VALUES (70, 'payroll.payment-schedules', '월급여일자관리', 64, '/payroll/payment-schedules', 'CalendarDays', 506, true, '2026-08-01 04:38:04.360738', '2026-08-01 04:38:04.360738');
INSERT INTO public.app_menus VALUES (71, 'payroll.employee-profiles', '직원급여프로필관리', 64, '/payroll/employee-profiles', 'Users', 507, true, '2026-08-01 04:38:04.420649', '2026-08-01 04:38:04.420649');
INSERT INTO public.app_menus VALUES (72, 'payroll.gl-accounts', '계정과목관리', 64, '/payroll/gl-accounts', 'Calculator', 508, true, '2026-08-01 04:38:04.481023', '2026-08-01 04:38:04.481023');
INSERT INTO public.app_menus VALUES (73, 'payroll.gl-mappings', '급여계정매핑관리', 64, '/payroll/gl-mappings', 'Calculator', 508, true, '2026-08-01 04:38:04.541242', '2026-08-01 04:38:04.541242');
INSERT INTO public.app_menus VALUES (74, 'payroll.severance-item-rules', '퇴직금산입규칙관리', 64, '/payroll/severance-item-rules', 'Calculator', 509, true, '2026-08-01 04:38:04.600153', '2026-08-01 04:38:04.600153');
INSERT INTO public.app_menus VALUES (75, 'payroll.process', '급여실행관리', 63, NULL, 'Wallet', 510, true, '2026-08-01 04:38:04.660243', '2026-08-01 04:38:04.660243');
INSERT INTO public.app_menus VALUES (76, 'payroll.variable-inputs', '월변동입력관리', 75, '/payroll/variable-inputs', 'NotebookPen', 511, true, '2026-08-01 04:38:04.7176', '2026-08-01 04:38:04.7176');
INSERT INTO public.app_menus VALUES (77, 'payroll.runs', '월급여Run관리', 75, '/payroll/runs', 'PlayCircle', 512, true, '2026-08-01 04:38:04.78019', '2026-08-01 04:38:04.78019');
INSERT INTO public.app_menus VALUES (78, 'payroll.vouchers', '급여전표관리', 75, '/payroll/vouchers', 'FileText', 513, true, '2026-08-01 04:38:04.839622', '2026-08-01 04:38:04.839622');
INSERT INTO public.app_menus VALUES (79, 'tra', '교육', NULL, NULL, 'FileText', 600, true, '2026-08-01 04:38:04.899203', '2026-08-01 04:38:04.899203');
INSERT INTO public.app_menus VALUES (80, 'tra.my-applications', '나의 교육 신청', 79, '/tra/my-applications', 'BookOpen', 600, true, '2026-08-01 04:38:04.960184', '2026-08-01 04:38:04.960184');
INSERT INTO public.app_menus VALUES (81, 'tra.course-events', '과정/차수 관리', 79, '/tra/course-events', 'ListOrdered', 601, true, '2026-08-01 04:38:05.019313', '2026-08-01 04:38:05.019313');
INSERT INTO public.app_menus VALUES (82, 'tra.applications', '교육신청 승인 관리', 79, '/tra/applications', 'ListOrdered', 602, true, '2026-08-01 04:38:05.070077', '2026-08-01 04:38:05.070077');
INSERT INTO public.app_menus VALUES (83, 'tra.required-standards', '필수교육 기준', 79, '/tra/required-standards', 'ListOrdered', 603, true, '2026-08-01 04:38:05.130972', '2026-08-01 04:38:05.130972');
INSERT INTO public.app_menus VALUES (84, 'tra.required-targets', '필수교육 대상', 79, '/tra/required-targets', 'ListOrdered', 604, true, '2026-08-01 04:38:05.192136', '2026-08-01 04:38:05.192136');
INSERT INTO public.app_menus VALUES (85, 'tra.elearning-windows', '이러닝 기간', 79, '/tra/elearning-windows', 'ListOrdered', 605, true, '2026-08-01 04:38:05.264586', '2026-08-01 04:38:05.264586');
INSERT INTO public.app_menus VALUES (86, 'tra.histories', '교육이력 관리', 79, '/tra/histories', 'ListOrdered', 606, true, '2026-08-01 04:38:05.340007', '2026-08-01 04:38:05.340007');
INSERT INTO public.app_menus VALUES (87, 'tra.cyber-upload', '사이버 업로드 반영', 79, '/tra/cyber-upload', 'ListOrdered', 607, true, '2026-08-01 04:38:05.411416', '2026-08-01 04:38:05.411416');
INSERT INTO public.app_menus VALUES (88, 'wel', '복리후생', NULL, NULL, 'HeartHandshake', 650, true, '2026-08-01 04:38:05.478646', '2026-08-01 04:38:05.478646');
INSERT INTO public.app_menus VALUES (90, 'mng', '관리', NULL, NULL, 'Briefcase', 800, true, '2026-08-01 04:38:05.600808', '2026-08-01 04:38:05.601077');
INSERT INTO public.app_menus VALUES (91, 'mng.client', '고객관리', 90, NULL, 'Building', 810, true, '2026-08-01 04:38:05.659568', '2026-08-01 04:38:05.659568');
INSERT INTO public.app_menus VALUES (92, 'mng.companies', '고객사관리', 91, '/mng/companies', 'Building', 811, true, '2026-08-01 04:38:05.728646', '2026-08-01 04:38:05.728646');
INSERT INTO public.app_menus VALUES (93, 'mng.manager-status', '담당자현황', 91, '/mng/manager-status', 'Users', 812, true, '2026-08-01 04:38:05.778772', '2026-08-01 04:38:05.778772');
INSERT INTO public.app_menus VALUES (94, 'mng.dev', '개발관리', 90, NULL, 'Code', 820, true, '2026-08-01 04:38:05.82822', '2026-08-01 04:38:05.82822');
INSERT INTO public.app_menus VALUES (95, 'mng.dev-requests', '추가개발관리', 94, '/mng/dev-requests', 'ListPlus', 821, true, '2026-08-01 04:38:05.878059', '2026-08-01 04:38:05.878059');
INSERT INTO public.app_menus VALUES (96, 'mng.dev-projects', '프로젝트관리', 94, '/mng/dev-projects', 'FolderKanban', 822, true, '2026-08-01 04:38:05.929157', '2026-08-01 04:38:05.929157');
INSERT INTO public.app_menus VALUES (97, 'mng.dev-inquiries', '문의관리', 94, '/mng/dev-inquiries', 'MessageSquare', 823, true, '2026-08-01 04:38:05.979796', '2026-08-01 04:38:05.979796');
INSERT INTO public.app_menus VALUES (98, 'mng.dev-staff', '인력현황', 94, '/mng/dev-staff', 'UserCheck', 824, true, '2026-08-01 04:38:06.036607', '2026-08-01 04:38:06.036607');
INSERT INTO public.app_menus VALUES (99, 'mng.outsource', '외주관리', 90, NULL, 'UserPlus', 830, true, '2026-08-01 04:38:06.088772', '2026-08-01 04:38:06.088772');
INSERT INTO public.app_menus VALUES (100, 'mng.outsource-contracts', '외주계약관리', 99, '/mng/outsource-contracts', 'FileText', 831, true, '2026-08-01 04:38:06.139079', '2026-08-01 04:38:06.139079');
INSERT INTO public.app_menus VALUES (101, 'mng.outsource-attendance', '외주근태현황', 99, '/mng/outsource-attendance', 'CalendarCheck', 832, true, '2026-08-01 04:38:06.196673', '2026-08-01 04:38:06.196673');
INSERT INTO public.app_menus VALUES (102, 'mng.infra', '인프라관리', 90, NULL, 'Server', 840, true, '2026-08-01 04:38:06.259449', '2026-08-01 04:38:06.259449');
INSERT INTO public.app_menus VALUES (103, 'mng.infra-config', '인프라구성관리', 102, '/mng/infra', 'Server', 841, true, '2026-08-01 04:38:06.267504', '2026-08-01 04:38:06.267504');
INSERT INTO public.app_menus VALUES (104, 'settings', '시스템', NULL, NULL, 'Settings', 900, true, '2026-08-01 04:38:06.274561', '2026-08-01 04:38:06.274561');
INSERT INTO public.app_menus VALUES (105, 'settings.base', '시스템기준관리', 104, NULL, 'Settings', 901, true, '2026-08-01 04:38:06.284794', '2026-08-01 04:38:06.284794');
INSERT INTO public.app_menus VALUES (106, 'settings.menus', '메뉴관리', 105, '/settings/menus', 'PanelLeft', 902, true, '2026-08-01 04:38:06.292331', '2026-08-01 04:38:06.292331');
INSERT INTO public.app_menus VALUES (107, 'settings.common-codes', '공통코드관리', 105, '/settings/common-codes', 'ListOrdered', 903, true, '2026-08-01 04:38:06.301688', '2026-08-01 04:38:06.301688');
INSERT INTO public.app_menus VALUES (108, 'settings.icons', '아이콘관리', 105, '/settings/icons', 'ListPlus', 904, true, '2026-08-01 04:38:06.309313', '2026-08-01 04:38:06.309313');
INSERT INTO public.app_menus VALUES (109, 'settings.system', '시스템기준관리', 105, '/settings/system', 'Settings', 905, true, '2026-08-01 04:38:06.318963', '2026-08-01 04:38:06.318963');
INSERT INTO public.app_menus VALUES (110, 'settings.auth', '권한', 104, NULL, 'Shield', 910, true, '2026-08-01 04:38:06.327662', '2026-08-01 04:38:06.327662');
INSERT INTO public.app_menus VALUES (111, 'settings.roles', '권한관리', 110, '/settings/roles', 'Shield', 911, true, '2026-08-01 04:38:06.334959', '2026-08-01 04:38:06.334959');
INSERT INTO public.app_menus VALUES (112, 'settings.permissions', '메뉴권한관리', 110, '/settings/permissions', 'Menu', 912, true, '2026-08-01 04:38:06.343444', '2026-08-01 04:38:06.343444');
INSERT INTO public.app_menus VALUES (113, 'settings.users', '사용자관리', 110, '/settings/users', 'UserRound', 913, true, '2026-08-01 04:38:06.351964', '2026-08-01 04:38:06.351964');
INSERT INTO public.app_menus VALUES (114, 'wel.requests', '복리후생 신청현황', 88, '/wel/requests', 'ListOrdered', 651, true, '2026-08-01 04:38:06.36756', '2026-08-01 04:38:06.36756');
INSERT INTO public.app_menus VALUES (115, 'wel.my-requests', '내 복리후생 신청', 88, '/wel/my-requests', 'ClipboardList', 652, true, '2026-08-01 04:38:06.437298', '2026-08-01 04:38:06.437298');
INSERT INTO public.app_menus VALUES (89, 'wel.benefit-types', '복리후생 유형관리', 88, '/wel/benefit-types', 'Gift', 653, true, '2026-08-01 04:38:05.539212', '2026-08-01 04:38:05.539212');


--
-- Data for Name: app_menu_actions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_menu_actions VALUES (1, 1, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (2, 1, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (3, 1, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (4, 1, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (5, 1, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (6, 1, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (7, 1, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (8, 4, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (9, 4, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (10, 4, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (11, 4, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (12, 4, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (13, 4, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (14, 4, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (15, 5, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (16, 5, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (17, 5, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (18, 5, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (19, 5, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (20, 5, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (21, 5, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (22, 7, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (23, 7, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (24, 7, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (25, 7, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (26, 7, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (27, 7, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (28, 7, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (29, 9, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (30, 9, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (31, 9, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (32, 9, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (33, 9, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (34, 9, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (35, 9, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (36, 10, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (37, 10, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (38, 10, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (39, 10, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (40, 10, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (41, 10, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (42, 10, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (43, 12, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (44, 12, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (45, 12, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (46, 12, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (47, 12, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (48, 12, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (49, 12, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (50, 13, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (51, 13, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (52, 13, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (53, 13, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (54, 13, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (55, 13, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (56, 13, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (57, 14, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (58, 14, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (59, 14, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (60, 14, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (61, 14, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (62, 14, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (63, 14, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (64, 15, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (65, 15, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (66, 15, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (67, 15, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (68, 15, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (69, 15, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (70, 15, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (71, 16, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (72, 16, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (73, 16, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (74, 16, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (75, 16, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (76, 16, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (77, 16, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (78, 17, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (79, 17, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (80, 17, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (81, 17, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (82, 17, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (83, 17, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (84, 17, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (85, 18, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (86, 18, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (87, 18, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (88, 18, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (89, 18, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (90, 18, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (91, 18, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (92, 20, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (93, 20, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (94, 20, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (95, 20, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (96, 20, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (97, 20, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (98, 20, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (99, 21, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (100, 21, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (101, 21, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (102, 21, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (103, 21, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (104, 21, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (105, 21, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (106, 22, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (107, 22, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (108, 22, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (109, 22, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (110, 22, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (111, 22, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (112, 22, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (113, 24, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (114, 24, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (115, 24, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (116, 24, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (117, 24, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (118, 24, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (119, 24, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (120, 25, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (121, 25, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (122, 25, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (123, 25, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (124, 25, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (125, 25, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (126, 25, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (127, 26, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (128, 26, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (129, 26, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (130, 26, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (131, 26, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (132, 26, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (133, 26, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (134, 29, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (135, 29, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (136, 29, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (137, 29, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (138, 29, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (139, 29, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (140, 29, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (141, 30, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (142, 30, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (143, 30, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (144, 30, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (145, 30, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (146, 30, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (147, 30, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (148, 31, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (149, 31, 'create', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (150, 31, 'copy', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (151, 31, 'template_download', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (152, 31, 'upload', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (153, 31, 'save', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (154, 31, 'download', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (155, 32, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (156, 32, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (157, 32, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (158, 32, 'template_download', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (159, 32, 'upload', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (160, 32, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (161, 32, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (162, 33, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (163, 33, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (164, 33, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (165, 33, 'template_download', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (166, 33, 'upload', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (167, 33, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (168, 33, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (169, 34, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (170, 34, 'create', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (171, 34, 'copy', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (172, 34, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (173, 34, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (174, 34, 'save', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (175, 34, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (176, 35, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (177, 35, 'create', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (178, 35, 'copy', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (179, 35, 'template_download', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (180, 35, 'upload', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (181, 35, 'save', false, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (182, 35, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (183, 36, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (184, 36, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (185, 36, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (186, 36, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (187, 36, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (188, 36, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (189, 36, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (190, 37, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (191, 37, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (192, 37, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (193, 37, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (194, 37, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (195, 37, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (196, 37, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (197, 40, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (198, 40, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (199, 40, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (200, 40, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (201, 40, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (202, 40, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (203, 40, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (204, 41, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (205, 41, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (206, 41, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (207, 41, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (208, 41, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (209, 41, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (210, 41, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (211, 42, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (212, 42, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (213, 42, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (214, 42, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (215, 42, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (216, 42, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (217, 42, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (218, 44, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (219, 44, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (220, 44, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (221, 44, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (222, 44, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (223, 44, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (224, 44, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (225, 45, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (226, 45, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (227, 45, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (228, 45, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (229, 45, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (230, 45, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (231, 45, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (232, 46, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (233, 46, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (234, 46, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (235, 46, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (236, 46, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (237, 46, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (238, 46, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (239, 48, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (240, 48, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (241, 48, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (242, 48, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (243, 48, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (244, 48, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (245, 48, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (246, 49, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (247, 49, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (248, 49, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (249, 49, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (250, 49, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (251, 49, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (252, 49, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (253, 50, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (254, 50, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (255, 50, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (256, 50, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (257, 50, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (258, 50, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (259, 50, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (260, 51, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (261, 51, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (262, 51, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (263, 51, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (264, 51, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (265, 51, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (266, 51, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (267, 52, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (268, 52, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (269, 52, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (270, 52, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (271, 52, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (272, 52, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (273, 52, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (274, 53, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (275, 53, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (276, 53, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (277, 53, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (278, 53, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (279, 53, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (280, 53, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (281, 56, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (282, 56, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (283, 56, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (284, 56, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (285, 56, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (286, 56, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (287, 56, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (288, 57, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (289, 57, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (290, 57, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (291, 57, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (292, 57, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (293, 57, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (294, 57, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (295, 58, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (296, 58, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (297, 58, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (298, 58, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (299, 58, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (300, 58, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (301, 58, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (302, 59, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (303, 59, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (304, 59, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (305, 59, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (306, 59, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (307, 59, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (308, 59, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (309, 61, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (310, 61, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (311, 61, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (312, 61, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (313, 61, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (314, 61, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (315, 61, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (316, 62, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (317, 62, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (318, 62, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (319, 62, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (320, 62, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (321, 62, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (322, 62, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (323, 65, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (324, 65, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (325, 65, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (326, 65, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (327, 65, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (328, 65, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (329, 65, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (330, 66, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (331, 66, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (332, 66, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (333, 66, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (334, 66, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (335, 66, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (336, 66, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (337, 67, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (338, 67, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (339, 67, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (340, 67, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (341, 67, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (342, 67, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (343, 67, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (344, 68, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (345, 68, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (346, 68, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (347, 68, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (348, 68, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (349, 68, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (350, 68, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (351, 69, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (352, 69, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (353, 69, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (354, 69, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (355, 69, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (356, 69, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (357, 69, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (358, 70, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (359, 70, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (360, 70, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (361, 70, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (362, 70, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (363, 70, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (364, 70, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (365, 71, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (366, 71, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (367, 71, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (368, 71, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (369, 71, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (370, 71, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (371, 71, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (372, 72, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (373, 72, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (374, 72, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (375, 72, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (376, 72, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (377, 72, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (378, 72, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (379, 73, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (380, 73, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (381, 73, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (382, 73, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (383, 73, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (384, 73, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (385, 73, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (386, 74, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (387, 74, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (388, 74, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (389, 74, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (390, 74, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (391, 74, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (392, 74, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (393, 76, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (394, 76, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (395, 76, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (396, 76, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (397, 76, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (398, 76, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (399, 76, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (400, 77, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (401, 77, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (402, 77, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (403, 77, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (404, 77, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (405, 77, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (406, 77, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (407, 78, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (408, 78, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (409, 78, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (410, 78, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (411, 78, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (412, 78, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (413, 78, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (414, 80, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (415, 80, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (416, 80, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (417, 80, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (418, 80, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (419, 80, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (420, 80, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (421, 81, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (422, 81, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (423, 81, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (424, 81, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (425, 81, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (426, 81, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (427, 81, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (428, 82, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (429, 82, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (430, 82, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (431, 82, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (432, 82, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (433, 82, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (434, 82, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (435, 83, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (436, 83, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (437, 83, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (438, 83, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (439, 83, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (440, 83, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (441, 83, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (442, 84, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (443, 84, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (444, 84, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (445, 84, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (446, 84, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (447, 84, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (448, 84, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (449, 85, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (450, 85, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (451, 85, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (452, 85, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (453, 85, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (454, 85, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (455, 85, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (456, 86, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (457, 86, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (458, 86, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (459, 86, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (460, 86, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (461, 86, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (462, 86, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (463, 87, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (464, 87, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (465, 87, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (466, 87, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (467, 87, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (468, 87, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (469, 87, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (470, 92, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (471, 92, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (472, 92, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (473, 92, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (474, 92, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (475, 92, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (476, 92, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (477, 93, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (478, 93, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (479, 93, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (480, 93, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (481, 93, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (482, 93, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (483, 93, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (484, 95, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (485, 95, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (486, 95, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (487, 95, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (488, 95, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (489, 95, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (490, 95, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (491, 96, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (492, 96, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (493, 96, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (494, 96, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (495, 96, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (496, 96, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (497, 96, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (498, 97, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (499, 97, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (500, 97, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (501, 97, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (502, 97, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (503, 97, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (504, 97, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (505, 98, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (506, 98, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (507, 98, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (508, 98, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (509, 98, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (510, 98, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (511, 98, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (512, 100, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (513, 100, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (514, 100, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (515, 100, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (516, 100, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (517, 100, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (518, 100, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (519, 101, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (520, 101, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (521, 101, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (522, 101, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (523, 101, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (524, 101, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (525, 101, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (526, 103, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (527, 103, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (528, 103, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (529, 103, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (530, 103, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (531, 103, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (532, 103, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (533, 106, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (534, 106, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (535, 106, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (536, 106, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (537, 106, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (538, 106, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (539, 106, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (540, 107, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (541, 107, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (542, 107, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (543, 107, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (544, 107, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (545, 107, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (546, 107, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (547, 108, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (548, 108, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (549, 108, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (550, 108, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (551, 108, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (552, 108, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (553, 108, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (554, 109, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (555, 109, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (556, 109, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (557, 109, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (558, 109, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (559, 109, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (560, 109, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (561, 111, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (562, 111, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (563, 111, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (564, 111, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (565, 111, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (566, 111, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (567, 111, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (568, 112, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (569, 112, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (570, 112, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (571, 112, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (572, 112, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (573, 112, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (574, 112, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (575, 113, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (576, 113, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (577, 113, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (578, 113, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (579, 113, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (580, 113, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (581, 113, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (582, 114, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (583, 114, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (584, 114, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (585, 114, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (586, 114, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (587, 114, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (588, 114, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (589, 115, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (590, 115, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (591, 115, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (592, 115, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (593, 115, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (594, 115, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (595, 115, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (596, 89, 'query', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (597, 89, 'create', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (598, 89, 'copy', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (599, 89, 'template_download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (600, 89, 'upload', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (601, 89, 'save', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');
INSERT INTO public.app_menu_actions VALUES (602, 89, 'download', true, '2026-08-01 04:38:06.502713', '2026-08-01 04:38:06.502713');


--
-- Data for Name: auth_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.auth_roles VALUES (1, 'admin', '관리자', '2026-08-01 04:37:59.835733');
INSERT INTO public.auth_roles VALUES (2, 'hr_manager', '인사담당자', '2026-08-01 04:37:59.840711');
INSERT INTO public.auth_roles VALUES (3, 'payroll_mgr', '급여담당자', '2026-08-01 04:37:59.84271');
INSERT INTO public.auth_roles VALUES (4, 'employee', '일반직원', '2026-08-01 04:37:59.844709');


--
-- Data for Name: app_menu_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_menu_roles VALUES (1, 1);
INSERT INTO public.app_menu_roles VALUES (1, 2);
INSERT INTO public.app_menu_roles VALUES (1, 3);
INSERT INTO public.app_menu_roles VALUES (1, 4);
INSERT INTO public.app_menu_roles VALUES (2, 1);
INSERT INTO public.app_menu_roles VALUES (2, 2);
INSERT INTO public.app_menu_roles VALUES (3, 1);
INSERT INTO public.app_menu_roles VALUES (3, 2);
INSERT INTO public.app_menu_roles VALUES (4, 1);
INSERT INTO public.app_menu_roles VALUES (4, 2);
INSERT INTO public.app_menu_roles VALUES (5, 1);
INSERT INTO public.app_menu_roles VALUES (5, 2);
INSERT INTO public.app_menu_roles VALUES (6, 1);
INSERT INTO public.app_menu_roles VALUES (6, 2);
INSERT INTO public.app_menu_roles VALUES (7, 1);
INSERT INTO public.app_menu_roles VALUES (7, 2);
INSERT INTO public.app_menu_roles VALUES (8, 1);
INSERT INTO public.app_menu_roles VALUES (8, 2);
INSERT INTO public.app_menu_roles VALUES (9, 1);
INSERT INTO public.app_menu_roles VALUES (9, 2);
INSERT INTO public.app_menu_roles VALUES (10, 1);
INSERT INTO public.app_menu_roles VALUES (10, 2);
INSERT INTO public.app_menu_roles VALUES (11, 1);
INSERT INTO public.app_menu_roles VALUES (11, 2);
INSERT INTO public.app_menu_roles VALUES (12, 1);
INSERT INTO public.app_menu_roles VALUES (12, 2);
INSERT INTO public.app_menu_roles VALUES (13, 1);
INSERT INTO public.app_menu_roles VALUES (13, 2);
INSERT INTO public.app_menu_roles VALUES (14, 1);
INSERT INTO public.app_menu_roles VALUES (14, 2);
INSERT INTO public.app_menu_roles VALUES (15, 1);
INSERT INTO public.app_menu_roles VALUES (15, 2);
INSERT INTO public.app_menu_roles VALUES (16, 1);
INSERT INTO public.app_menu_roles VALUES (16, 2);
INSERT INTO public.app_menu_roles VALUES (17, 1);
INSERT INTO public.app_menu_roles VALUES (17, 2);
INSERT INTO public.app_menu_roles VALUES (18, 1);
INSERT INTO public.app_menu_roles VALUES (18, 2);
INSERT INTO public.app_menu_roles VALUES (19, 1);
INSERT INTO public.app_menu_roles VALUES (19, 2);
INSERT INTO public.app_menu_roles VALUES (20, 1);
INSERT INTO public.app_menu_roles VALUES (20, 2);
INSERT INTO public.app_menu_roles VALUES (21, 1);
INSERT INTO public.app_menu_roles VALUES (21, 2);
INSERT INTO public.app_menu_roles VALUES (22, 1);
INSERT INTO public.app_menu_roles VALUES (22, 2);
INSERT INTO public.app_menu_roles VALUES (22, 3);
INSERT INTO public.app_menu_roles VALUES (23, 1);
INSERT INTO public.app_menu_roles VALUES (23, 2);
INSERT INTO public.app_menu_roles VALUES (24, 1);
INSERT INTO public.app_menu_roles VALUES (24, 2);
INSERT INTO public.app_menu_roles VALUES (25, 1);
INSERT INTO public.app_menu_roles VALUES (25, 2);
INSERT INTO public.app_menu_roles VALUES (26, 1);
INSERT INTO public.app_menu_roles VALUES (26, 2);
INSERT INTO public.app_menu_roles VALUES (27, 1);
INSERT INTO public.app_menu_roles VALUES (27, 2);
INSERT INTO public.app_menu_roles VALUES (28, 1);
INSERT INTO public.app_menu_roles VALUES (28, 2);
INSERT INTO public.app_menu_roles VALUES (29, 1);
INSERT INTO public.app_menu_roles VALUES (29, 2);
INSERT INTO public.app_menu_roles VALUES (30, 1);
INSERT INTO public.app_menu_roles VALUES (30, 2);
INSERT INTO public.app_menu_roles VALUES (31, 1);
INSERT INTO public.app_menu_roles VALUES (31, 2);
INSERT INTO public.app_menu_roles VALUES (32, 1);
INSERT INTO public.app_menu_roles VALUES (32, 2);
INSERT INTO public.app_menu_roles VALUES (33, 1);
INSERT INTO public.app_menu_roles VALUES (33, 2);
INSERT INTO public.app_menu_roles VALUES (34, 1);
INSERT INTO public.app_menu_roles VALUES (34, 2);
INSERT INTO public.app_menu_roles VALUES (35, 1);
INSERT INTO public.app_menu_roles VALUES (35, 2);
INSERT INTO public.app_menu_roles VALUES (36, 1);
INSERT INTO public.app_menu_roles VALUES (36, 2);
INSERT INTO public.app_menu_roles VALUES (37, 1);
INSERT INTO public.app_menu_roles VALUES (37, 2);
INSERT INTO public.app_menu_roles VALUES (38, 1);
INSERT INTO public.app_menu_roles VALUES (38, 2);
INSERT INTO public.app_menu_roles VALUES (38, 4);
INSERT INTO public.app_menu_roles VALUES (39, 1);
INSERT INTO public.app_menu_roles VALUES (39, 2);
INSERT INTO public.app_menu_roles VALUES (40, 1);
INSERT INTO public.app_menu_roles VALUES (40, 2);
INSERT INTO public.app_menu_roles VALUES (41, 1);
INSERT INTO public.app_menu_roles VALUES (41, 2);
INSERT INTO public.app_menu_roles VALUES (42, 1);
INSERT INTO public.app_menu_roles VALUES (42, 2);
INSERT INTO public.app_menu_roles VALUES (43, 1);
INSERT INTO public.app_menu_roles VALUES (43, 2);
INSERT INTO public.app_menu_roles VALUES (43, 4);
INSERT INTO public.app_menu_roles VALUES (44, 1);
INSERT INTO public.app_menu_roles VALUES (44, 2);
INSERT INTO public.app_menu_roles VALUES (44, 4);
INSERT INTO public.app_menu_roles VALUES (45, 1);
INSERT INTO public.app_menu_roles VALUES (45, 2);
INSERT INTO public.app_menu_roles VALUES (46, 1);
INSERT INTO public.app_menu_roles VALUES (46, 2);
INSERT INTO public.app_menu_roles VALUES (47, 1);
INSERT INTO public.app_menu_roles VALUES (47, 2);
INSERT INTO public.app_menu_roles VALUES (47, 4);
INSERT INTO public.app_menu_roles VALUES (48, 1);
INSERT INTO public.app_menu_roles VALUES (48, 2);
INSERT INTO public.app_menu_roles VALUES (48, 4);
INSERT INTO public.app_menu_roles VALUES (49, 1);
INSERT INTO public.app_menu_roles VALUES (49, 2);
INSERT INTO public.app_menu_roles VALUES (49, 4);
INSERT INTO public.app_menu_roles VALUES (50, 1);
INSERT INTO public.app_menu_roles VALUES (50, 2);
INSERT INTO public.app_menu_roles VALUES (51, 1);
INSERT INTO public.app_menu_roles VALUES (51, 2);
INSERT INTO public.app_menu_roles VALUES (52, 1);
INSERT INTO public.app_menu_roles VALUES (52, 2);
INSERT INTO public.app_menu_roles VALUES (53, 1);
INSERT INTO public.app_menu_roles VALUES (53, 2);
INSERT INTO public.app_menu_roles VALUES (54, 1);
INSERT INTO public.app_menu_roles VALUES (54, 2);
INSERT INTO public.app_menu_roles VALUES (54, 4);
INSERT INTO public.app_menu_roles VALUES (55, 1);
INSERT INTO public.app_menu_roles VALUES (55, 2);
INSERT INTO public.app_menu_roles VALUES (55, 4);
INSERT INTO public.app_menu_roles VALUES (56, 1);
INSERT INTO public.app_menu_roles VALUES (56, 2);
INSERT INTO public.app_menu_roles VALUES (56, 4);
INSERT INTO public.app_menu_roles VALUES (57, 1);
INSERT INTO public.app_menu_roles VALUES (57, 2);
INSERT INTO public.app_menu_roles VALUES (57, 4);
INSERT INTO public.app_menu_roles VALUES (58, 1);
INSERT INTO public.app_menu_roles VALUES (58, 2);
INSERT INTO public.app_menu_roles VALUES (58, 4);
INSERT INTO public.app_menu_roles VALUES (59, 1);
INSERT INTO public.app_menu_roles VALUES (59, 2);
INSERT INTO public.app_menu_roles VALUES (59, 4);
INSERT INTO public.app_menu_roles VALUES (60, 1);
INSERT INTO public.app_menu_roles VALUES (60, 2);
INSERT INTO public.app_menu_roles VALUES (61, 1);
INSERT INTO public.app_menu_roles VALUES (61, 2);
INSERT INTO public.app_menu_roles VALUES (62, 1);
INSERT INTO public.app_menu_roles VALUES (62, 2);
INSERT INTO public.app_menu_roles VALUES (63, 1);
INSERT INTO public.app_menu_roles VALUES (63, 3);
INSERT INTO public.app_menu_roles VALUES (64, 1);
INSERT INTO public.app_menu_roles VALUES (64, 3);
INSERT INTO public.app_menu_roles VALUES (65, 1);
INSERT INTO public.app_menu_roles VALUES (65, 3);
INSERT INTO public.app_menu_roles VALUES (66, 1);
INSERT INTO public.app_menu_roles VALUES (66, 3);
INSERT INTO public.app_menu_roles VALUES (67, 1);
INSERT INTO public.app_menu_roles VALUES (67, 3);
INSERT INTO public.app_menu_roles VALUES (68, 1);
INSERT INTO public.app_menu_roles VALUES (68, 3);
INSERT INTO public.app_menu_roles VALUES (69, 1);
INSERT INTO public.app_menu_roles VALUES (69, 3);
INSERT INTO public.app_menu_roles VALUES (70, 1);
INSERT INTO public.app_menu_roles VALUES (70, 3);
INSERT INTO public.app_menu_roles VALUES (71, 1);
INSERT INTO public.app_menu_roles VALUES (71, 3);
INSERT INTO public.app_menu_roles VALUES (72, 1);
INSERT INTO public.app_menu_roles VALUES (72, 3);
INSERT INTO public.app_menu_roles VALUES (73, 1);
INSERT INTO public.app_menu_roles VALUES (73, 3);
INSERT INTO public.app_menu_roles VALUES (74, 1);
INSERT INTO public.app_menu_roles VALUES (74, 3);
INSERT INTO public.app_menu_roles VALUES (75, 1);
INSERT INTO public.app_menu_roles VALUES (75, 3);
INSERT INTO public.app_menu_roles VALUES (76, 1);
INSERT INTO public.app_menu_roles VALUES (76, 3);
INSERT INTO public.app_menu_roles VALUES (77, 1);
INSERT INTO public.app_menu_roles VALUES (77, 3);
INSERT INTO public.app_menu_roles VALUES (78, 1);
INSERT INTO public.app_menu_roles VALUES (78, 3);
INSERT INTO public.app_menu_roles VALUES (79, 1);
INSERT INTO public.app_menu_roles VALUES (79, 2);
INSERT INTO public.app_menu_roles VALUES (79, 4);
INSERT INTO public.app_menu_roles VALUES (80, 1);
INSERT INTO public.app_menu_roles VALUES (80, 2);
INSERT INTO public.app_menu_roles VALUES (80, 4);
INSERT INTO public.app_menu_roles VALUES (81, 1);
INSERT INTO public.app_menu_roles VALUES (81, 2);
INSERT INTO public.app_menu_roles VALUES (81, 4);
INSERT INTO public.app_menu_roles VALUES (82, 1);
INSERT INTO public.app_menu_roles VALUES (82, 2);
INSERT INTO public.app_menu_roles VALUES (83, 1);
INSERT INTO public.app_menu_roles VALUES (83, 2);
INSERT INTO public.app_menu_roles VALUES (83, 4);
INSERT INTO public.app_menu_roles VALUES (84, 1);
INSERT INTO public.app_menu_roles VALUES (84, 2);
INSERT INTO public.app_menu_roles VALUES (84, 4);
INSERT INTO public.app_menu_roles VALUES (85, 1);
INSERT INTO public.app_menu_roles VALUES (85, 2);
INSERT INTO public.app_menu_roles VALUES (85, 4);
INSERT INTO public.app_menu_roles VALUES (86, 1);
INSERT INTO public.app_menu_roles VALUES (86, 2);
INSERT INTO public.app_menu_roles VALUES (86, 4);
INSERT INTO public.app_menu_roles VALUES (87, 1);
INSERT INTO public.app_menu_roles VALUES (87, 2);
INSERT INTO public.app_menu_roles VALUES (87, 4);
INSERT INTO public.app_menu_roles VALUES (88, 1);
INSERT INTO public.app_menu_roles VALUES (88, 2);
INSERT INTO public.app_menu_roles VALUES (88, 3);
INSERT INTO public.app_menu_roles VALUES (89, 1);
INSERT INTO public.app_menu_roles VALUES (89, 2);
INSERT INTO public.app_menu_roles VALUES (89, 3);
INSERT INTO public.app_menu_roles VALUES (90, 1);
INSERT INTO public.app_menu_roles VALUES (90, 2);
INSERT INTO public.app_menu_roles VALUES (91, 1);
INSERT INTO public.app_menu_roles VALUES (91, 2);
INSERT INTO public.app_menu_roles VALUES (92, 1);
INSERT INTO public.app_menu_roles VALUES (92, 2);
INSERT INTO public.app_menu_roles VALUES (93, 1);
INSERT INTO public.app_menu_roles VALUES (93, 2);
INSERT INTO public.app_menu_roles VALUES (94, 1);
INSERT INTO public.app_menu_roles VALUES (94, 2);
INSERT INTO public.app_menu_roles VALUES (95, 1);
INSERT INTO public.app_menu_roles VALUES (95, 2);
INSERT INTO public.app_menu_roles VALUES (96, 1);
INSERT INTO public.app_menu_roles VALUES (96, 2);
INSERT INTO public.app_menu_roles VALUES (97, 1);
INSERT INTO public.app_menu_roles VALUES (97, 2);
INSERT INTO public.app_menu_roles VALUES (98, 1);
INSERT INTO public.app_menu_roles VALUES (98, 2);
INSERT INTO public.app_menu_roles VALUES (99, 1);
INSERT INTO public.app_menu_roles VALUES (99, 2);
INSERT INTO public.app_menu_roles VALUES (100, 1);
INSERT INTO public.app_menu_roles VALUES (100, 2);
INSERT INTO public.app_menu_roles VALUES (101, 1);
INSERT INTO public.app_menu_roles VALUES (101, 2);
INSERT INTO public.app_menu_roles VALUES (102, 1);
INSERT INTO public.app_menu_roles VALUES (103, 1);
INSERT INTO public.app_menu_roles VALUES (104, 1);
INSERT INTO public.app_menu_roles VALUES (105, 1);
INSERT INTO public.app_menu_roles VALUES (106, 1);
INSERT INTO public.app_menu_roles VALUES (107, 1);
INSERT INTO public.app_menu_roles VALUES (108, 1);
INSERT INTO public.app_menu_roles VALUES (109, 1);
INSERT INTO public.app_menu_roles VALUES (110, 1);
INSERT INTO public.app_menu_roles VALUES (111, 1);
INSERT INTO public.app_menu_roles VALUES (112, 1);
INSERT INTO public.app_menu_roles VALUES (113, 1);
INSERT INTO public.app_menu_roles VALUES (114, 1);
INSERT INTO public.app_menu_roles VALUES (114, 2);
INSERT INTO public.app_menu_roles VALUES (114, 3);
INSERT INTO public.app_menu_roles VALUES (115, 1);
INSERT INTO public.app_menu_roles VALUES (115, 2);
INSERT INTO public.app_menu_roles VALUES (115, 4);


--
-- Data for Name: app_role_menu_actions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: auth_users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: app_system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_system_settings VALUES (1, 'auth.session.access_ttl_min', 'auth', 'int', '120', 'Access JWT 만료시간(분)', true, NULL, '2026-08-01 04:38:06.579766');
INSERT INTO public.app_system_settings VALUES (2, 'auth.session.refresh_threshold_min', 'auth', 'int', '60', '갱신 임계치(분)', true, NULL, '2026-08-01 04:38:06.579766');
INSERT INTO public.app_system_settings VALUES (3, 'auth.session.remember_enabled', 'auth', 'bool', 'true', 'Remember me 허용 여부', true, NULL, '2026-08-01 04:38:06.579766');
INSERT INTO public.app_system_settings VALUES (4, 'auth.session.remember_ttl_min', 'auth', 'int', '43200', 'Remember me 쿠키 만료(분)', true, NULL, '2026-08-01 04:38:06.579766');
INSERT INTO public.app_system_settings VALUES (5, 'auth.session.show_countdown', 'auth', 'bool', 'true', '상단 세션 카운트다운 표시 여부', true, NULL, '2026-08-01 04:38:06.579766');


--
-- Data for Name: app_system_setting_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: auth_user_roles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: gl_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.gl_accounts VALUES (1, '5100', '급여비용', 'expense', false, true, 10, '2026-08-01 04:38:07.10807', '2026-08-01 04:38:07.10807', false);
INSERT INTO public.gl_accounts VALUES (2, '5110', '상여비용', 'expense', false, true, 20, '2026-08-01 04:38:07.110082', '2026-08-01 04:38:07.110082', false);
INSERT INTO public.gl_accounts VALUES (3, '5120', '제수당비용', 'expense', false, true, 30, '2026-08-01 04:38:07.111501', '2026-08-01 04:38:07.111501', false);
INSERT INTO public.gl_accounts VALUES (4, '5130', '복리후생비', 'expense', false, true, 40, '2026-08-01 04:38:07.112501', '2026-08-01 04:38:07.112501', false);
INSERT INTO public.gl_accounts VALUES (5, '2100', '미지급급여', 'liability', true, true, 110, '2026-08-01 04:38:07.113502', '2026-08-01 04:38:07.113502', false);
INSERT INTO public.gl_accounts VALUES (6, '2210', '소득세예수금', 'liability', false, true, 120, '2026-08-01 04:38:07.114501', '2026-08-01 04:38:07.114501', false);
INSERT INTO public.gl_accounts VALUES (7, '2220', '지방소득세예수금', 'liability', false, true, 130, '2026-08-01 04:38:07.115501', '2026-08-01 04:38:07.116518', false);
INSERT INTO public.gl_accounts VALUES (8, '2230', '국민연금예수금', 'liability', false, true, 140, '2026-08-01 04:38:07.117461', '2026-08-01 04:38:07.117461', false);
INSERT INTO public.gl_accounts VALUES (9, '2240', '건강보험예수금', 'liability', false, true, 150, '2026-08-01 04:38:07.118436', '2026-08-01 04:38:07.118436', false);
INSERT INTO public.gl_accounts VALUES (10, '2250', '장기요양보험예수금', 'liability', false, true, 160, '2026-08-01 04:38:07.119538', '2026-08-01 04:38:07.119538', false);
INSERT INTO public.gl_accounts VALUES (11, '2260', '고용보험예수금', 'liability', false, true, 170, '2026-08-01 04:38:07.120049', '2026-08-01 04:38:07.120049', false);
INSERT INTO public.gl_accounts VALUES (12, '1400', '사내대출채권', 'asset', false, true, 210, '2026-08-01 04:38:07.12105', '2026-08-01 04:38:07.12105', false);
INSERT INTO public.gl_accounts VALUES (13, '1100', '보통예금', 'asset', false, true, 220, '2026-08-01 04:38:07.12205', '2026-08-01 04:38:07.12205', true);


--
-- Data for Name: hr_appointment_orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_departments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.org_departments VALUES (1, 'HQ-HR', '인사본부', NULL, 'HEADQUARTERS', 'CC-HR-001', '인사 정책, 발령, 평가, 급여 기준 운영', true, '2026-08-01 04:37:59.870632', '2026-08-01 04:37:59.870632');
INSERT INTO public.org_departments VALUES (2, 'HQ-ENG', '개발본부', NULL, 'HEADQUARTERS', 'CC-ENG-001', '제품 개발, 플랫폼 개선, 기술 운영', true, '2026-08-01 04:37:59.878374', '2026-08-01 04:37:59.878374');
INSERT INTO public.org_departments VALUES (3, 'HQ-SALES', '영업본부', NULL, 'HEADQUARTERS', 'CC-SALES-001', '영업 전략, 고객 발굴, 수주 관리', true, '2026-08-01 04:37:59.885935', '2026-08-01 04:37:59.885946');
INSERT INTO public.org_departments VALUES (4, 'HQ-FIN', '재무본부', NULL, 'HEADQUARTERS', 'CC-FIN-001', '회계, 자금, 예산, 결산 관리', true, '2026-08-01 04:37:59.891072', '2026-08-01 04:37:59.891072');
INSERT INTO public.org_departments VALUES (5, 'HQ-OPS', '운영본부', NULL, 'HEADQUARTERS', 'CC-OPS-001', '운영 표준, 지원 프로세스, 현장 운영', true, '2026-08-01 04:37:59.902884', '2026-08-01 04:37:59.902884');
INSERT INTO public.org_departments VALUES (6, 'ORG-0001', '조직01', NULL, 'TEAM', 'CC-ORG-0001', '샘플 조직 01 운영 단위', true, '2026-08-01 04:37:59.915137', '2026-08-01 04:37:59.915137');
INSERT INTO public.org_departments VALUES (7, 'ORG-0002', '조직02', NULL, 'TEAM', 'CC-ORG-0002', '샘플 조직 02 운영 단위', true, '2026-08-01 04:37:59.92186', '2026-08-01 04:37:59.92186');
INSERT INTO public.org_departments VALUES (8, 'ORG-0003', '조직03', NULL, 'TEAM', 'CC-ORG-0003', '샘플 조직 03 운영 단위', true, '2026-08-01 04:37:59.928576', '2026-08-01 04:37:59.928576');
INSERT INTO public.org_departments VALUES (9, 'ORG-0004', '조직04', NULL, 'TEAM', 'CC-ORG-0004', '샘플 조직 04 운영 단위', true, '2026-08-01 04:37:59.936072', '2026-08-01 04:37:59.936072');
INSERT INTO public.org_departments VALUES (10, 'ORG-0005', '조직05', NULL, 'TEAM', 'CC-ORG-0005', '샘플 조직 05 운영 단위', true, '2026-08-01 04:37:59.950166', '2026-08-01 04:37:59.950166');
INSERT INTO public.org_departments VALUES (11, 'ORG-0006', '조직06', NULL, 'TEAM', 'CC-ORG-0006', '샘플 조직 06 운영 단위', true, '2026-08-01 04:37:59.973632', '2026-08-01 04:37:59.973653');
INSERT INTO public.org_departments VALUES (12, 'ORG-0007', '조직07', NULL, 'TEAM', 'CC-ORG-0007', '샘플 조직 07 운영 단위', true, '2026-08-01 04:37:59.988364', '2026-08-01 04:37:59.988364');
INSERT INTO public.org_departments VALUES (13, 'ORG-0008', '조직08', NULL, 'TEAM', 'CC-ORG-0008', '샘플 조직 08 운영 단위', true, '2026-08-01 04:38:00.001755', '2026-08-01 04:38:00.001755');
INSERT INTO public.org_departments VALUES (14, 'ORG-0009', '조직09', NULL, 'TEAM', 'CC-ORG-0009', '샘플 조직 09 운영 단위', true, '2026-08-01 04:38:00.008579', '2026-08-01 04:38:00.008579');
INSERT INTO public.org_departments VALUES (15, 'ORG-0010', '조직10', NULL, 'TEAM', 'CC-ORG-0010', '샘플 조직 10 운영 단위', true, '2026-08-01 04:38:00.01432', '2026-08-01 04:38:00.01432');
INSERT INTO public.org_departments VALUES (16, 'ORG-0011', '조직11', NULL, 'TEAM', 'CC-ORG-0011', '샘플 조직 11 운영 단위', true, '2026-08-01 04:38:00.031605', '2026-08-01 04:38:00.031605');
INSERT INTO public.org_departments VALUES (17, 'ORG-0012', '조직12', NULL, 'TEAM', 'CC-ORG-0012', '샘플 조직 12 운영 단위', true, '2026-08-01 04:38:00.037968', '2026-08-01 04:38:00.037968');
INSERT INTO public.org_departments VALUES (18, 'ORG-0013', '조직13', NULL, 'TEAM', 'CC-ORG-0013', '샘플 조직 13 운영 단위', true, '2026-08-01 04:38:00.050597', '2026-08-01 04:38:00.050597');
INSERT INTO public.org_departments VALUES (19, 'ORG-0014', '조직14', NULL, 'TEAM', 'CC-ORG-0014', '샘플 조직 14 운영 단위', true, '2026-08-01 04:38:00.0576', '2026-08-01 04:38:00.0576');
INSERT INTO public.org_departments VALUES (20, 'ORG-0015', '조직15', NULL, 'TEAM', 'CC-ORG-0015', '샘플 조직 15 운영 단위', true, '2026-08-01 04:38:00.064599', '2026-08-01 04:38:00.064599');
INSERT INTO public.org_departments VALUES (21, 'ORG-0016', '조직16', NULL, 'TEAM', 'CC-ORG-0016', '샘플 조직 16 운영 단위', true, '2026-08-01 04:38:00.0713', '2026-08-01 04:38:00.0713');
INSERT INTO public.org_departments VALUES (22, 'ORG-0017', '조직17', NULL, 'TEAM', 'CC-ORG-0017', '샘플 조직 17 운영 단위', true, '2026-08-01 04:38:00.079995', '2026-08-01 04:38:00.079995');
INSERT INTO public.org_departments VALUES (23, 'ORG-0018', '조직18', NULL, 'TEAM', 'CC-ORG-0018', '샘플 조직 18 운영 단위', true, '2026-08-01 04:38:00.08955', '2026-08-01 04:38:00.08955');
INSERT INTO public.org_departments VALUES (24, 'ORG-0019', '조직19', NULL, 'TEAM', 'CC-ORG-0019', '샘플 조직 19 운영 단위', true, '2026-08-01 04:38:00.095779', '2026-08-01 04:38:00.095779');
INSERT INTO public.org_departments VALUES (25, 'ORG-0020', '조직20', NULL, 'TEAM', 'CC-ORG-0020', '샘플 조직 20 운영 단위', true, '2026-08-01 04:38:00.104548', '2026-08-01 04:38:00.104548');
INSERT INTO public.org_departments VALUES (26, 'ORG-0021', '조직21', NULL, 'TEAM', 'CC-ORG-0021', '샘플 조직 21 운영 단위', true, '2026-08-01 04:38:00.11032', '2026-08-01 04:38:00.11032');
INSERT INTO public.org_departments VALUES (27, 'ORG-0022', '조직22', NULL, 'TEAM', 'CC-ORG-0022', '샘플 조직 22 운영 단위', true, '2026-08-01 04:38:00.118729', '2026-08-01 04:38:00.118749');
INSERT INTO public.org_departments VALUES (28, 'ORG-0023', '조직23', NULL, 'TEAM', 'CC-ORG-0023', '샘플 조직 23 운영 단위', true, '2026-08-01 04:38:00.133241', '2026-08-01 04:38:00.133241');
INSERT INTO public.org_departments VALUES (29, 'ORG-0024', '조직24', NULL, 'TEAM', 'CC-ORG-0024', '샘플 조직 24 운영 단위', true, '2026-08-01 04:38:00.141535', '2026-08-01 04:38:00.141535');
INSERT INTO public.org_departments VALUES (30, 'ORG-0025', '조직25', NULL, 'TEAM', 'CC-ORG-0025', '샘플 조직 25 운영 단위', true, '2026-08-01 04:38:00.148606', '2026-08-01 04:38:00.149605');
INSERT INTO public.org_departments VALUES (31, 'ORG-0026', '조직26', NULL, 'TEAM', 'CC-ORG-0026', '샘플 조직 26 운영 단위', true, '2026-08-01 04:38:00.159071', '2026-08-01 04:38:00.159071');
INSERT INTO public.org_departments VALUES (32, 'ORG-0027', '조직27', NULL, 'TEAM', 'CC-ORG-0027', '샘플 조직 27 운영 단위', true, '2026-08-01 04:38:00.167349', '2026-08-01 04:38:00.167349');
INSERT INTO public.org_departments VALUES (33, 'ORG-0028', '조직28', NULL, 'TEAM', 'CC-ORG-0028', '샘플 조직 28 운영 단위', true, '2026-08-01 04:38:00.172898', '2026-08-01 04:38:00.172898');
INSERT INTO public.org_departments VALUES (34, 'ORG-0029', '조직29', NULL, 'TEAM', 'CC-ORG-0029', '샘플 조직 29 운영 단위', true, '2026-08-01 04:38:00.179289', '2026-08-01 04:38:00.179289');
INSERT INTO public.org_departments VALUES (35, 'ORG-0030', '조직30', NULL, 'TEAM', 'CC-ORG-0030', '샘플 조직 30 운영 단위', true, '2026-08-01 04:38:00.18521', '2026-08-01 04:38:00.18521');
INSERT INTO public.org_departments VALUES (36, 'ORG-0031', '조직31', NULL, 'TEAM', 'CC-ORG-0031', '샘플 조직 31 운영 단위', true, '2026-08-01 04:38:00.191166', '2026-08-01 04:38:00.191166');
INSERT INTO public.org_departments VALUES (37, 'ORG-0032', '조직32', NULL, 'TEAM', 'CC-ORG-0032', '샘플 조직 32 운영 단위', true, '2026-08-01 04:38:00.197965', '2026-08-01 04:38:00.197965');
INSERT INTO public.org_departments VALUES (38, 'ORG-0033', '조직33', NULL, 'TEAM', 'CC-ORG-0033', '샘플 조직 33 운영 단위', true, '2026-08-01 04:38:00.204444', '2026-08-01 04:38:00.204444');
INSERT INTO public.org_departments VALUES (39, 'ORG-0034', '조직34', NULL, 'TEAM', 'CC-ORG-0034', '샘플 조직 34 운영 단위', true, '2026-08-01 04:38:00.21315', '2026-08-01 04:38:00.21315');
INSERT INTO public.org_departments VALUES (40, 'ORG-0035', '조직35', NULL, 'TEAM', 'CC-ORG-0035', '샘플 조직 35 운영 단위', true, '2026-08-01 04:38:00.219312', '2026-08-01 04:38:00.219312');
INSERT INTO public.org_departments VALUES (41, 'ORG-0036', '조직36', NULL, 'TEAM', 'CC-ORG-0036', '샘플 조직 36 운영 단위', true, '2026-08-01 04:38:00.224935', '2026-08-01 04:38:00.224935');
INSERT INTO public.org_departments VALUES (42, 'ORG-0037', '조직37', NULL, 'TEAM', 'CC-ORG-0037', '샘플 조직 37 운영 단위', true, '2026-08-01 04:38:00.230066', '2026-08-01 04:38:00.230066');
INSERT INTO public.org_departments VALUES (43, 'ORG-0038', '조직38', NULL, 'TEAM', 'CC-ORG-0038', '샘플 조직 38 운영 단위', true, '2026-08-01 04:38:00.235344', '2026-08-01 04:38:00.235344');
INSERT INTO public.org_departments VALUES (44, 'ORG-0039', '조직39', NULL, 'TEAM', 'CC-ORG-0039', '샘플 조직 39 운영 단위', true, '2026-08-01 04:38:00.240621', '2026-08-01 04:38:00.240621');
INSERT INTO public.org_departments VALUES (45, 'ORG-0040', '조직40', NULL, 'TEAM', 'CC-ORG-0040', '샘플 조직 40 운영 단위', true, '2026-08-01 04:38:00.248038', '2026-08-01 04:38:00.248038');
INSERT INTO public.org_departments VALUES (46, 'ORG-0041', '조직41', NULL, 'TEAM', 'CC-ORG-0041', '샘플 조직 41 운영 단위', true, '2026-08-01 04:38:00.255427', '2026-08-01 04:38:00.255427');
INSERT INTO public.org_departments VALUES (47, 'ORG-0042', '조직42', NULL, 'TEAM', 'CC-ORG-0042', '샘플 조직 42 운영 단위', true, '2026-08-01 04:38:00.261484', '2026-08-01 04:38:00.261484');
INSERT INTO public.org_departments VALUES (48, 'ORG-0043', '조직43', NULL, 'TEAM', 'CC-ORG-0043', '샘플 조직 43 운영 단위', true, '2026-08-01 04:38:00.268487', '2026-08-01 04:38:00.268487');
INSERT INTO public.org_departments VALUES (49, 'ORG-0044', '조직44', NULL, 'TEAM', 'CC-ORG-0044', '샘플 조직 44 운영 단위', true, '2026-08-01 04:38:00.275483', '2026-08-01 04:38:00.275483');
INSERT INTO public.org_departments VALUES (50, 'ORG-0045', '조직45', NULL, 'TEAM', 'CC-ORG-0045', '샘플 조직 45 운영 단위', true, '2026-08-01 04:38:00.282483', '2026-08-01 04:38:00.282483');


--
-- Data for Name: hr_employees; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_appointment_order_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_careers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_contact_points; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_employee_basic_profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_employee_info_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_licenses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_military; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_personnel_histories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_recruit_finalists; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_retire_cases; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_retire_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_retire_checklist_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hr_retire_checklist_items VALUES (1, 'asset_return', '회사 자산 반납', '노트북/출입카드 등 지급 자산 반납', true, true, 10, '2026-08-01 04:38:06.864032', '2026-08-01 04:38:06.864032');
INSERT INTO public.hr_retire_checklist_items VALUES (2, 'document_handover', '업무 인수인계 완료', '담당 업무 및 문서 인수인계', true, true, 20, '2026-08-01 04:38:06.866032', '2026-08-01 04:38:06.866032');
INSERT INTO public.hr_retire_checklist_items VALUES (3, 'account_close', '계정/권한 회수', '내부 시스템 계정 및 권한 회수', true, true, 30, '2026-08-01 04:38:06.867618', '2026-08-01 04:38:06.867618');
INSERT INTO public.hr_retire_checklist_items VALUES (4, 'expense_settlement', '비용 정산 완료', '법인카드/개인비용 정산', false, true, 40, '2026-08-01 04:38:06.86962', '2026-08-01 04:38:06.86962');


--
-- Data for Name: hr_retire_case_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_form_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_form_types VALUES (1, 'LEAVE_REQUEST', 'Leave request', NULL, 'TIM', true, true, true, false, 25, NULL, NULL, '2026-08-01 04:38:07.179622', '2026-08-01 04:38:07.179622');
INSERT INTO public.hri_form_types VALUES (2, 'WEL_BENEFIT_REQUEST', 'Welfare benefit request', NULL, 'WEL', true, true, true, true, 35, NULL, NULL, '2026-08-01 04:38:07.181623', '2026-08-01 04:38:07.181623');
INSERT INTO public.hri_form_types VALUES (3, 'CERT_EMPLOYMENT', '재직증명서 신청', NULL, 'HR', true, true, true, true, 10, NULL, NULL, '2026-08-01 04:38:07.183624', '2026-08-01 04:38:07.183624');
INSERT INTO public.hri_form_types VALUES (4, 'TIM_CORRECTION', '근태 정정 신청', NULL, 'TIM', true, true, true, false, 20, NULL, NULL, '2026-08-01 04:38:07.184623', '2026-08-01 04:38:07.184623');
INSERT INTO public.hri_form_types VALUES (5, 'EXPENSE_COMMON', '공통 경비 신청', NULL, 'CPN', true, true, true, true, 30, NULL, NULL, '2026-08-01 04:38:07.185623', '2026-08-01 04:38:07.185623');


--
-- Data for Name: hri_request_masters; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_reward_punish; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hr_severance_calcs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_approval_actor_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_approval_actor_rules VALUES (1, 'TEAM_LEADER', 'ORG_CHAIN', 'HR_ADMIN', '["팀장"]', true, '2026-08-01 04:38:07.218291', '2026-08-01 04:38:07.218291');
INSERT INTO public.hri_approval_actor_rules VALUES (2, 'DEPT_HEAD', 'ORG_CHAIN', 'HR_ADMIN', '["부서장","본부장","실장"]', true, '2026-08-01 04:38:07.221749', '2026-08-01 04:38:07.221749');
INSERT INTO public.hri_approval_actor_rules VALUES (3, 'CEO', 'JOB_POSITION', 'HR_ADMIN', '["대표","CEO","사장"]', true, '2026-08-01 04:38:07.22275', '2026-08-01 04:38:07.22275');
INSERT INTO public.hri_approval_actor_rules VALUES (4, 'HR_ADMIN', 'FIXED_USER', 'HR_ADMIN', NULL, true, '2026-08-01 04:38:07.223751', '2026-08-01 04:38:07.223751');


--
-- Data for Name: hri_approval_line_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_approval_line_templates VALUES (1, 'HRI_TMPL_CERT', '증명서 기본 결재선', 'GLOBAL', NULL, false, true, 120, '2026-08-01 04:38:07.227761', '2026-08-01 04:38:07.228558');
INSERT INTO public.hri_approval_line_templates VALUES (2, 'HRI_TMPL_TIM_SIMPLE', '근태 기본 결재선', 'GLOBAL', NULL, false, true, 110, '2026-08-01 04:38:07.296163', '2026-08-01 04:38:07.296163');
INSERT INTO public.hri_approval_line_templates VALUES (3, 'HRI_TMPL_WEL_RECEIVE', '복리후생 기본 결재선', 'GLOBAL', NULL, false, true, 115, '2026-08-01 04:38:07.300157', '2026-08-01 04:38:07.300157');
INSERT INTO public.hri_approval_line_templates VALUES (4, 'HRI_TMPL_DEFAULT', '공통 기본 결재선', 'GLOBAL', NULL, true, true, 100, '2026-08-01 04:38:07.303204', '2026-08-01 04:38:07.303204');


--
-- Data for Name: hri_approval_line_steps; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_approval_line_steps VALUES (1, 1, 1, 'APPROVAL', 'ROLE_BASED', 'TEAM_LEADER', NULL, true, 'APPROVE', '2026-08-01 04:38:07.292087', '2026-08-01 04:38:07.292087');
INSERT INTO public.hri_approval_line_steps VALUES (2, 1, 2, 'APPROVAL', 'ROLE_BASED', 'DEPT_HEAD', NULL, true, 'APPROVE', '2026-08-01 04:38:07.292087', '2026-08-01 04:38:07.292087');
INSERT INTO public.hri_approval_line_steps VALUES (3, 1, 3, 'APPROVAL', 'ROLE_BASED', 'CEO', NULL, true, 'APPROVE', '2026-08-01 04:38:07.292087', '2026-08-01 04:38:07.292087');
INSERT INTO public.hri_approval_line_steps VALUES (4, 1, 4, 'RECEIVE', 'ROLE_BASED', 'HR_ADMIN', NULL, true, 'RECEIVE', '2026-08-01 04:38:07.293087', '2026-08-01 04:38:07.293087');
INSERT INTO public.hri_approval_line_steps VALUES (5, 2, 1, 'APPROVAL', 'ROLE_BASED', 'TEAM_LEADER', NULL, true, 'APPROVE', '2026-08-01 04:38:07.29816', '2026-08-01 04:38:07.29816');
INSERT INTO public.hri_approval_line_steps VALUES (6, 2, 2, 'APPROVAL', 'ROLE_BASED', 'DEPT_HEAD', NULL, true, 'APPROVE', '2026-08-01 04:38:07.29816', '2026-08-01 04:38:07.29816');
INSERT INTO public.hri_approval_line_steps VALUES (7, 3, 1, 'APPROVAL', 'ROLE_BASED', 'TEAM_LEADER', NULL, true, 'APPROVE', '2026-08-01 04:38:07.301158', '2026-08-01 04:38:07.301158');
INSERT INTO public.hri_approval_line_steps VALUES (8, 3, 2, 'APPROVAL', 'ROLE_BASED', 'DEPT_HEAD', NULL, true, 'APPROVE', '2026-08-01 04:38:07.301158', '2026-08-01 04:38:07.301158');
INSERT INTO public.hri_approval_line_steps VALUES (9, 3, 3, 'RECEIVE', 'ROLE_BASED', 'HR_ADMIN', NULL, true, 'RECEIVE', '2026-08-01 04:38:07.301158', '2026-08-01 04:38:07.301158');
INSERT INTO public.hri_approval_line_steps VALUES (10, 4, 1, 'APPROVAL', 'ROLE_BASED', 'TEAM_LEADER', NULL, true, 'APPROVE', '2026-08-01 04:38:07.304264', '2026-08-01 04:38:07.304264');
INSERT INTO public.hri_approval_line_steps VALUES (11, 4, 2, 'APPROVAL', 'ROLE_BASED', 'DEPT_HEAD', NULL, true, 'APPROVE', '2026-08-01 04:38:07.304264', '2026-08-01 04:38:07.304264');
INSERT INTO public.hri_approval_line_steps VALUES (12, 4, 3, 'APPROVAL', 'ROLE_BASED', 'CEO', NULL, true, 'APPROVE', '2026-08-01 04:38:07.304264', '2026-08-01 04:38:07.304264');


--
-- Data for Name: hri_form_type_approval_maps; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_form_type_approval_maps VALUES (1, 3, 1, true, '2026-01-01', NULL, '2026-08-01 04:38:07.311112', '2026-08-01 04:38:07.311112');
INSERT INTO public.hri_form_type_approval_maps VALUES (2, 4, 2, true, '2026-01-01', NULL, '2026-08-01 04:38:07.314747', '2026-08-01 04:38:07.314747');
INSERT INTO public.hri_form_type_approval_maps VALUES (3, 1, 2, true, '2026-01-01', NULL, '2026-08-01 04:38:07.317468', '2026-08-01 04:38:07.317468');
INSERT INTO public.hri_form_type_approval_maps VALUES (4, 2, 3, true, '2026-01-01', NULL, '2026-08-01 04:38:07.32037', '2026-08-01 04:38:07.32037');
INSERT INTO public.hri_form_type_approval_maps VALUES (5, 5, 4, true, '2026-01-01', NULL, '2026-08-01 04:38:07.32037', '2026-08-01 04:38:07.32037');


--
-- Data for Name: hri_form_type_policies; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hri_form_type_policies VALUES (1, 3, 'attachment_required', 'false', '2026-01-01', NULL, '2026-08-01 04:38:07.191621', '2026-08-01 04:38:07.191621');
INSERT INTO public.hri_form_type_policies VALUES (2, 3, 'max_attachment_count', '3', '2026-01-01', NULL, '2026-08-01 04:38:07.193994', '2026-08-01 04:38:07.193994');
INSERT INTO public.hri_form_type_policies VALUES (3, 4, 'attachment_required', 'true', '2026-01-01', NULL, '2026-08-01 04:38:07.196996', '2026-08-01 04:38:07.196996');
INSERT INTO public.hri_form_type_policies VALUES (4, 4, 'max_attachment_count', '5', '2026-01-01', NULL, '2026-08-01 04:38:07.197998', '2026-08-01 04:38:07.197998');
INSERT INTO public.hri_form_type_policies VALUES (5, 1, 'attachment_required', 'false', '2026-01-01', NULL, '2026-08-01 04:38:07.20004', '2026-08-01 04:38:07.20004');
INSERT INTO public.hri_form_type_policies VALUES (6, 1, 'max_attachment_count', '3', '2026-01-01', NULL, '2026-08-01 04:38:07.201352', '2026-08-01 04:38:07.202351');
INSERT INTO public.hri_form_type_policies VALUES (7, 1, 'allow_past_date', 'false', '2026-01-01', NULL, '2026-08-01 04:38:07.203351', '2026-08-01 04:38:07.203351');
INSERT INTO public.hri_form_type_policies VALUES (8, 1, 'max_span_days', '31', '2026-01-01', NULL, '2026-08-01 04:38:07.204351', '2026-08-01 04:38:07.204351');
INSERT INTO public.hri_form_type_policies VALUES (9, 1, 'require_reason', 'true', '2026-01-01', NULL, '2026-08-01 04:38:07.205352', '2026-08-01 04:38:07.205352');
INSERT INTO public.hri_form_type_policies VALUES (10, 2, 'attachment_required', 'false', '2026-01-01', NULL, '2026-08-01 04:38:07.207865', '2026-08-01 04:38:07.207865');
INSERT INTO public.hri_form_type_policies VALUES (11, 2, 'max_attachment_count', '5', '2026-01-01', NULL, '2026-08-01 04:38:07.208866', '2026-08-01 04:38:07.208866');
INSERT INTO public.hri_form_type_policies VALUES (12, 2, 'benefit_type_required', 'true', '2026-01-01', NULL, '2026-08-01 04:38:07.209865', '2026-08-01 04:38:07.209865');
INSERT INTO public.hri_form_type_policies VALUES (13, 2, 'require_reason', 'true', '2026-01-01', NULL, '2026-08-01 04:38:07.210865', '2026-08-01 04:38:07.210865');
INSERT INTO public.hri_form_type_policies VALUES (14, 5, 'attachment_required', 'true', '2026-01-01', NULL, '2026-08-01 04:38:07.212866', '2026-08-01 04:38:07.212866');
INSERT INTO public.hri_form_type_policies VALUES (15, 5, 'max_attachment_count', '10', '2026-01-01', NULL, '2026-08-01 04:38:07.213877', '2026-08-01 04:38:07.213877');


--
-- Data for Name: hri_req_cert_employment; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_req_leave; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_req_tim_attendance; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_req_tim_correction; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_request_attachments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_request_counters; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_request_histories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: hri_request_step_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_companies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_dev_inquiries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_dev_projects; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_dev_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_infra_masters; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_infra_configs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_manager_companies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_outsource_contracts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mng_outsource_attendances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_corporations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.org_corporations VALUES (1, 'VIBE', 'VIBE', 'VIBE-HR', '110111-1234567', '123-45-67890', NULL, NULL, '/vibehr_mark.svg', true, '2026-08-01 04:37:59.856525', '2026-08-01 04:37:59.856525');


--
-- Data for Name: org_dept_change_histories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_mapping_type_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_mapping_assignments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_restructure_plans; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: org_restructure_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pap_appraisal_targets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_allowance_deductions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_allowance_deductions VALUES (1, 'BSC', '기본급', 'allowance', 'taxable', 'fixed', true, 10, '2026-08-01 04:38:07.074208', '2026-08-01 04:38:07.074208');
INSERT INTO public.pay_allowance_deductions VALUES (2, 'MLA', '식대', 'allowance', 'non-taxable', 'fixed', true, 20, '2026-08-01 04:38:07.077209', '2026-08-01 04:38:07.077209');
INSERT INTO public.pay_allowance_deductions VALUES (3, 'OTX', '연장수당', 'allowance', 'taxable', 'fixed', true, 30, '2026-08-01 04:38:07.078208', '2026-08-01 04:38:07.078208');
INSERT INTO public.pay_allowance_deductions VALUES (4, 'NGT', '야간수당', 'allowance', 'taxable', 'fixed', true, 40, '2026-08-01 04:38:07.079209', '2026-08-01 04:38:07.079209');
INSERT INTO public.pay_allowance_deductions VALUES (5, 'HDW', '휴일근무수당', 'allowance', 'taxable', 'fixed', true, 35, '2026-08-01 04:38:07.08021', '2026-08-01 04:38:07.08021');
INSERT INTO public.pay_allowance_deductions VALUES (6, 'HDO', '휴일연장수당', 'allowance', 'taxable', 'fixed', true, 36, '2026-08-01 04:38:07.081209', '2026-08-01 04:38:07.081209');
INSERT INTO public.pay_allowance_deductions VALUES (7, 'HDN', '휴일야간수당', 'allowance', 'taxable', 'fixed', true, 37, '2026-08-01 04:38:07.083208', '2026-08-01 04:38:07.083208');
INSERT INTO public.pay_allowance_deductions VALUES (8, 'POS', '직책수당', 'allowance', 'taxable', 'fixed', true, 50, '2026-08-01 04:38:07.084208', '2026-08-01 04:38:07.084208');
INSERT INTO public.pay_allowance_deductions VALUES (9, 'PEN', '국민연금', 'deduction', 'insurance', 'formula', true, 110, '2026-08-01 04:38:07.085208', '2026-08-01 04:38:07.085208');
INSERT INTO public.pay_allowance_deductions VALUES (10, 'HIN', '건강보험', 'deduction', 'insurance', 'formula', true, 120, '2026-08-01 04:38:07.086208', '2026-08-01 04:38:07.086208');
INSERT INTO public.pay_allowance_deductions VALUES (11, 'EMP', '고용보험', 'deduction', 'insurance', 'formula', true, 125, '2026-08-01 04:38:07.087208', '2026-08-01 04:38:07.087208');
INSERT INTO public.pay_allowance_deductions VALUES (12, 'LTC', '장기요양', 'deduction', 'insurance', 'formula', true, 127, '2026-08-01 04:38:07.088208', '2026-08-01 04:38:07.088208');
INSERT INTO public.pay_allowance_deductions VALUES (13, 'ITX', '소득세', 'deduction', 'tax', 'formula', true, 130, '2026-08-01 04:38:07.089651', '2026-08-01 04:38:07.089651');
INSERT INTO public.pay_allowance_deductions VALUES (14, 'LTX', '지방소득세', 'deduction', 'tax', 'formula', true, 135, '2026-08-01 04:38:07.090653', '2026-08-01 04:38:07.090653');
INSERT INTO public.pay_allowance_deductions VALUES (15, 'SCHOLARSHIP_GRANT', '학자금지원', 'allowance', 'taxable', 'fixed', true, 210, '2026-08-01 04:38:07.092652', '2026-08-01 04:38:07.092652');
INSERT INTO public.pay_allowance_deductions VALUES (16, 'CONDOLENCE_GRANT', '경조금', 'allowance', 'taxable', 'fixed', true, 220, '2026-08-01 04:38:07.093653', '2026-08-01 04:38:07.093653');
INSERT INTO public.pay_allowance_deductions VALUES (17, 'MEDICAL_GRANT', '의료비지원', 'allowance', 'taxable', 'fixed', true, 230, '2026-08-01 04:38:07.094653', '2026-08-01 04:38:07.094653');
INSERT INTO public.pay_allowance_deductions VALUES (18, 'LOAN_REPAY', '사내대출상환', 'deduction', 'tax', 'fixed', true, 310, '2026-08-01 04:38:07.095674', '2026-08-01 04:38:07.095674');
INSERT INTO public.pay_allowance_deductions VALUES (19, 'PENSION_DEDUCT', '개인연금공제', 'deduction', 'tax', 'fixed', true, 320, '2026-08-01 04:38:07.097606', '2026-08-01 04:38:07.097606');
INSERT INTO public.pay_allowance_deductions VALUES (20, 'CLUB_DEDUCT', '동호회공제', 'deduction', 'tax', 'fixed', true, 330, '2026-08-01 04:38:07.098604', '2026-08-01 04:38:07.098604');


--
-- Data for Name: pay_item_groups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_item_groups VALUES (1, 'GR-OFFICE', '사무직 그룹', '사무직 급여 항목 기본 그룹', true, '2026-08-01 04:38:07.101603', '2026-08-01 04:38:07.101603');
INSERT INTO public.pay_item_groups VALUES (2, 'GR-PROD', '생산직 그룹', '생산직 급여 항목 기본 그룹', true, '2026-08-01 04:38:07.104069', '2026-08-01 04:38:07.104069');


--
-- Data for Name: pay_payroll_codes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_payroll_codes VALUES (1, 'P100', '정규급여', '급여', '25', true, true, true, '2026-08-01 04:38:07.03216', '2026-08-01 04:38:07.03216');
INSERT INTO public.pay_payroll_codes VALUES (2, 'P200', '정기상여', '상여', '25', true, true, true, '2026-08-01 04:38:07.035142', '2026-08-01 04:38:07.035142');
INSERT INTO public.pay_payroll_codes VALUES (3, 'P300', '연차수당', '수당', '당월말일', true, true, true, '2026-08-01 04:38:07.036142', '2026-08-01 04:38:07.036142');


--
-- Data for Name: pay_employee_profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_gl_mappings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_gl_mappings VALUES (1, 'BSC', '5100', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.126487', '2026-08-01 04:38:07.126487');
INSERT INTO public.pay_gl_mappings VALUES (2, 'MLA', '5130', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.129579', '2026-08-01 04:38:07.129579');
INSERT INTO public.pay_gl_mappings VALUES (3, 'OTX', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.130693', '2026-08-01 04:38:07.130693');
INSERT INTO public.pay_gl_mappings VALUES (4, 'NGT', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.132147', '2026-08-01 04:38:07.132147');
INSERT INTO public.pay_gl_mappings VALUES (5, 'HDW', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.132147', '2026-08-01 04:38:07.132147');
INSERT INTO public.pay_gl_mappings VALUES (6, 'HDO', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.132147', '2026-08-01 04:38:07.132147');
INSERT INTO public.pay_gl_mappings VALUES (7, 'HDN', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.132147', '2026-08-01 04:38:07.132147');
INSERT INTO public.pay_gl_mappings VALUES (8, 'POS', '5120', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.132147', '2026-08-01 04:38:07.132147');
INSERT INTO public.pay_gl_mappings VALUES (9, 'PEN', '2230', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.138312', '2026-08-01 04:38:07.138312');
INSERT INTO public.pay_gl_mappings VALUES (10, 'HIN', '2240', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (11, 'EMP', '2260', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (12, 'LTC', '2250', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (13, 'ITX', '2210', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (14, 'LTX', '2220', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (15, 'SCHOLARSHIP_GRANT', '5130', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.139923', '2026-08-01 04:38:07.139923');
INSERT INTO public.pay_gl_mappings VALUES (16, 'CONDOLENCE_GRANT', '5130', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.146225', '2026-08-01 04:38:07.146225');
INSERT INTO public.pay_gl_mappings VALUES (17, 'MEDICAL_GRANT', '5130', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.147336', '2026-08-01 04:38:07.147336');
INSERT INTO public.pay_gl_mappings VALUES (18, 'LOAN_REPAY', '1400', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.147876', '2026-08-01 04:38:07.147876');
INSERT INTO public.pay_gl_mappings VALUES (19, 'PENSION_DEDUCT', '2230', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.148847', '2026-08-01 04:38:07.148847');
INSERT INTO public.pay_gl_mappings VALUES (20, 'CLUB_DEDUCT', '2260', '2020-01-01', '초기 시드 매핑', true, '2026-08-01 04:38:07.149847', '2026-08-01 04:38:07.149847');


--
-- Data for Name: pay_income_tax_brackets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_income_tax_brackets VALUES (1, 2025, 0, 14000000, 6, 0, '2026-08-01 04:38:07.052892', '2026-08-01 04:38:07.052892');
INSERT INTO public.pay_income_tax_brackets VALUES (2, 2025, 14000000, 50000000, 15, 1260000, '2026-08-01 04:38:07.055541', '2026-08-01 04:38:07.055541');
INSERT INTO public.pay_income_tax_brackets VALUES (3, 2025, 50000000, 88000000, 24, 5760000, '2026-08-01 04:38:07.056541', '2026-08-01 04:38:07.056541');
INSERT INTO public.pay_income_tax_brackets VALUES (4, 2025, 88000000, 150000000, 35, 15440000, '2026-08-01 04:38:07.057542', '2026-08-01 04:38:07.057542');
INSERT INTO public.pay_income_tax_brackets VALUES (5, 2025, 150000000, 300000000, 38, 19940000, '2026-08-01 04:38:07.058541', '2026-08-01 04:38:07.058541');
INSERT INTO public.pay_income_tax_brackets VALUES (6, 2025, 300000000, 500000000, 40, 25940000, '2026-08-01 04:38:07.05954', '2026-08-01 04:38:07.05954');
INSERT INTO public.pay_income_tax_brackets VALUES (7, 2025, 500000000, 1000000000, 42, 35940000, '2026-08-01 04:38:07.06054', '2026-08-01 04:38:07.06054');
INSERT INTO public.pay_income_tax_brackets VALUES (8, 2025, 1000000000, NULL, 45, 65940000, '2026-08-01 04:38:07.06254', '2026-08-01 04:38:07.06254');
INSERT INTO public.pay_income_tax_brackets VALUES (9, 2026, 0, 14000000, 6, 0, '2026-08-01 04:38:07.063541', '2026-08-01 04:38:07.063541');
INSERT INTO public.pay_income_tax_brackets VALUES (10, 2026, 14000000, 50000000, 15, 1260000, '2026-08-01 04:38:07.06454', '2026-08-01 04:38:07.06454');
INSERT INTO public.pay_income_tax_brackets VALUES (11, 2026, 50000000, 88000000, 24, 5760000, '2026-08-01 04:38:07.06554', '2026-08-01 04:38:07.06554');
INSERT INTO public.pay_income_tax_brackets VALUES (12, 2026, 88000000, 150000000, 35, 15440000, '2026-08-01 04:38:07.066541', '2026-08-01 04:38:07.066541');
INSERT INTO public.pay_income_tax_brackets VALUES (13, 2026, 150000000, 300000000, 38, 19940000, '2026-08-01 04:38:07.067541', '2026-08-01 04:38:07.067541');
INSERT INTO public.pay_income_tax_brackets VALUES (14, 2026, 300000000, 500000000, 40, 25940000, '2026-08-01 04:38:07.06859', '2026-08-01 04:38:07.06859');
INSERT INTO public.pay_income_tax_brackets VALUES (15, 2026, 500000000, 1000000000, 42, 35940000, '2026-08-01 04:38:07.069591', '2026-08-01 04:38:07.069591');
INSERT INTO public.pay_income_tax_brackets VALUES (16, 2026, 1000000000, NULL, 45, 65940000, '2026-08-01 04:38:07.071208', '2026-08-01 04:38:07.071208');


--
-- Data for Name: pay_item_group_details; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_runs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_run_employees; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_run_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_run_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_run_targets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_payroll_run_target_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_severance_item_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_severance_item_rules VALUES (1, 'BSC', 'full', '기본급 - 전액 산입', true, '2026-08-01 04:38:07.154364', '2026-08-01 04:38:07.154364');
INSERT INTO public.pay_severance_item_rules VALUES (2, 'MLA', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.156364', '2026-08-01 04:38:07.156364');
INSERT INTO public.pay_severance_item_rules VALUES (3, 'OTX', 'exclude', '연장수당 - 평균임금 산입 제외 예시', true, '2026-08-01 04:38:07.157364', '2026-08-01 04:38:07.157364');
INSERT INTO public.pay_severance_item_rules VALUES (4, 'NGT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.158364', '2026-08-01 04:38:07.158364');
INSERT INTO public.pay_severance_item_rules VALUES (5, 'HDW', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.159366', '2026-08-01 04:38:07.159366');
INSERT INTO public.pay_severance_item_rules VALUES (6, 'HDO', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.160364', '2026-08-01 04:38:07.160364');
INSERT INTO public.pay_severance_item_rules VALUES (7, 'HDN', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.162477', '2026-08-01 04:38:07.162477');
INSERT INTO public.pay_severance_item_rules VALUES (8, 'POS', 'prorate_12', '직책수당 - 연간 총액의 3/12 비율로 안분 산입', true, '2026-08-01 04:38:07.163478', '2026-08-01 04:38:07.163478');
INSERT INTO public.pay_severance_item_rules VALUES (9, 'PEN', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.164478', '2026-08-01 04:38:07.164478');
INSERT INTO public.pay_severance_item_rules VALUES (10, 'HIN', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.165478', '2026-08-01 04:38:07.165478');
INSERT INTO public.pay_severance_item_rules VALUES (11, 'EMP', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.166477', '2026-08-01 04:38:07.166477');
INSERT INTO public.pay_severance_item_rules VALUES (12, 'LTC', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.167478', '2026-08-01 04:38:07.167478');
INSERT INTO public.pay_severance_item_rules VALUES (13, 'ITX', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.168477', '2026-08-01 04:38:07.168477');
INSERT INTO public.pay_severance_item_rules VALUES (14, 'LTX', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.169478', '2026-08-01 04:38:07.169478');
INSERT INTO public.pay_severance_item_rules VALUES (15, 'SCHOLARSHIP_GRANT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.170478', '2026-08-01 04:38:07.170478');
INSERT INTO public.pay_severance_item_rules VALUES (16, 'CONDOLENCE_GRANT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.171477', '2026-08-01 04:38:07.171477');
INSERT INTO public.pay_severance_item_rules VALUES (17, 'MEDICAL_GRANT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.172478', '2026-08-01 04:38:07.172478');
INSERT INTO public.pay_severance_item_rules VALUES (18, 'LOAN_REPAY', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.173477', '2026-08-01 04:38:07.173477');
INSERT INTO public.pay_severance_item_rules VALUES (19, 'PENSION_DEDUCT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.174477', '2026-08-01 04:38:07.174477');
INSERT INTO public.pay_severance_item_rules VALUES (20, 'CLUB_DEDUCT', 'full', '기본값: 전액 산입', true, '2026-08-01 04:38:07.175478', '2026-08-01 04:38:07.175478');


--
-- Data for Name: pay_tax_rates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pay_tax_rates VALUES (1, 2025, '국민연금', 4.5, 4.5, 390000, 6170000, '2026-08-01 04:38:07.040163', '2026-08-01 04:38:07.040163');
INSERT INTO public.pay_tax_rates VALUES (2, 2025, '건강보험', 3.545, 3.545, 279266, 110332300, '2026-08-01 04:38:07.042059', '2026-08-01 04:38:07.042059');
INSERT INTO public.pay_tax_rates VALUES (3, 2025, '장기요양', 0.4591, 0.4591, NULL, NULL, '2026-08-01 04:38:07.043059', '2026-08-01 04:38:07.043059');
INSERT INTO public.pay_tax_rates VALUES (4, 2025, '고용보험', 0.9, 1.15, NULL, NULL, '2026-08-01 04:38:07.044058', '2026-08-01 04:38:07.044058');
INSERT INTO public.pay_tax_rates VALUES (5, 2026, '국민연금', 4.5, 4.5, 390000, 6170000, '2026-08-01 04:38:07.045059', '2026-08-01 04:38:07.045059');
INSERT INTO public.pay_tax_rates VALUES (6, 2026, '건강보험', 3.545, 3.545, 279266, 110332300, '2026-08-01 04:38:07.046985', '2026-08-01 04:38:07.046985');
INSERT INTO public.pay_tax_rates VALUES (7, 2026, '장기요양', 0.4591, 0.4591, NULL, NULL, '2026-08-01 04:38:07.048033', '2026-08-01 04:38:07.048033');
INSERT INTO public.pay_tax_rates VALUES (8, 2026, '고용보험', 0.9, 1.15, NULL, NULL, '2026-08-01 04:38:07.049035', '2026-08-01 04:38:07.049035');


--
-- Data for Name: pay_variable_inputs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_vouchers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pay_voucher_lines; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_annual_leaves; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_attendance_codes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_attendance_codes VALUES (1, 'C01', '연차휴가', 'leave', 'day', true, 1, 25, true, true, 10, NULL, '2026-08-01 04:38:06.873644', '2026-08-01 04:38:06.873644');
INSERT INTO public.tim_attendance_codes VALUES (2, 'C01A', '오전반차', 'leave', 'am', true, 0.5, 0.5, true, true, 20, NULL, '2026-08-01 04:38:06.876462', '2026-08-01 04:38:06.876462');
INSERT INTO public.tim_attendance_codes VALUES (3, 'C01B', '오후반차', 'leave', 'pm', true, 0.5, 0.5, true, true, 30, NULL, '2026-08-01 04:38:06.877509', '2026-08-01 04:38:06.877509');
INSERT INTO public.tim_attendance_codes VALUES (4, 'C02', '하계휴가', 'leave', 'day', true, 1, 5, false, true, 40, NULL, '2026-08-01 04:38:06.878486', '2026-08-01 04:38:06.878486');
INSERT INTO public.tim_attendance_codes VALUES (5, 'C03', '대체휴가', 'leave', 'day', true, 1, 100, false, true, 50, NULL, '2026-08-01 04:38:06.879487', '2026-08-01 04:38:06.879487');
INSERT INTO public.tim_attendance_codes VALUES (6, 'C04', '병가', 'leave', 'day', true, 1, 90, false, true, 60, NULL, '2026-08-01 04:38:06.881365', '2026-08-01 04:38:06.881365');
INSERT INTO public.tim_attendance_codes VALUES (7, 'C05', '경조휴가', 'leave', 'day', true, 1, 5, false, true, 70, NULL, '2026-08-01 04:38:06.883365', '2026-08-01 04:38:06.883365');
INSERT INTO public.tim_attendance_codes VALUES (8, 'C06', '공가', 'leave', 'day', true, 1, 10, false, true, 80, NULL, '2026-08-01 04:38:06.884366', '2026-08-01 04:38:06.884366');
INSERT INTO public.tim_attendance_codes VALUES (9, 'C07', '교육', 'leave', 'day', true, 1, 30, false, true, 90, NULL, '2026-08-01 04:38:06.885366', '2026-08-01 04:38:06.885366');
INSERT INTO public.tim_attendance_codes VALUES (10, 'C08', '출산휴가', 'leave', 'day', true, 1, 120, false, true, 100, NULL, '2026-08-01 04:38:06.886366', '2026-08-01 04:38:06.886366');
INSERT INTO public.tim_attendance_codes VALUES (11, 'C09', '육아휴직', 'leave', 'day', true, 1, 365, false, true, 110, NULL, '2026-08-01 04:38:06.887923', '2026-08-01 04:38:06.887923');
INSERT INTO public.tim_attendance_codes VALUES (12, 'W01', '정상출근', 'work', 'day', false, NULL, NULL, false, true, 200, NULL, '2026-08-01 04:38:06.888322', '2026-08-01 04:38:06.888322');
INSERT INTO public.tim_attendance_codes VALUES (13, 'W02', '지각', 'work', 'day', false, NULL, NULL, false, true, 210, NULL, '2026-08-01 04:38:06.889324', '2026-08-01 04:38:06.890324');
INSERT INTO public.tim_attendance_codes VALUES (14, 'W03', '조퇴', 'work', 'day', false, NULL, NULL, false, true, 220, NULL, '2026-08-01 04:38:06.891323', '2026-08-01 04:38:06.891323');
INSERT INTO public.tim_attendance_codes VALUES (15, 'W04', '결근', 'work', 'day', false, NULL, NULL, false, true, 230, NULL, '2026-08-01 04:38:06.892389', '2026-08-01 04:38:06.892389');
INSERT INTO public.tim_attendance_codes VALUES (16, 'W05', '외출', 'work', 'hour', true, NULL, NULL, false, true, 240, NULL, '2026-08-01 04:38:06.892901', '2026-08-01 04:38:06.892901');
INSERT INTO public.tim_attendance_codes VALUES (17, 'W06', '출장', 'work', 'day', true, 1, 30, false, true, 250, NULL, '2026-08-01 04:38:06.893902', '2026-08-01 04:38:06.893902');
INSERT INTO public.tim_attendance_codes VALUES (18, 'W07', '재택근무', 'work', 'day', true, 1, 30, false, true, 260, NULL, '2026-08-01 04:38:06.895262', '2026-08-01 04:38:06.895262');


--
-- Data for Name: tim_attendance_daily; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_attendance_corrections; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_schedule_patterns; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_schedule_patterns VALUES (1, 'PTN_DEPT_STD', '부서기본(월~금 09-18)', NULL, true, '2026-08-01 04:38:06.913601', '2026-08-01 04:38:06.913601');


--
-- Data for Name: tim_department_schedule_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_department_schedule_assignments VALUES (1, 1, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.931476', '2026-08-01 04:38:06.931476');
INSERT INTO public.tim_department_schedule_assignments VALUES (2, 2, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.933476', '2026-08-01 04:38:06.933476');
INSERT INTO public.tim_department_schedule_assignments VALUES (3, 3, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.935476', '2026-08-01 04:38:06.935476');
INSERT INTO public.tim_department_schedule_assignments VALUES (4, 4, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.936488', '2026-08-01 04:38:06.936488');
INSERT INTO public.tim_department_schedule_assignments VALUES (5, 5, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.937918', '2026-08-01 04:38:06.937918');
INSERT INTO public.tim_department_schedule_assignments VALUES (6, 6, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.938918', '2026-08-01 04:38:06.938918');
INSERT INTO public.tim_department_schedule_assignments VALUES (7, 7, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.940918', '2026-08-01 04:38:06.940918');
INSERT INTO public.tim_department_schedule_assignments VALUES (8, 8, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.941918', '2026-08-01 04:38:06.941918');
INSERT INTO public.tim_department_schedule_assignments VALUES (9, 9, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.942938', '2026-08-01 04:38:06.942938');
INSERT INTO public.tim_department_schedule_assignments VALUES (10, 10, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.944829', '2026-08-01 04:38:06.944829');
INSERT INTO public.tim_department_schedule_assignments VALUES (11, 11, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.945829', '2026-08-01 04:38:06.945829');
INSERT INTO public.tim_department_schedule_assignments VALUES (12, 12, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.946829', '2026-08-01 04:38:06.946829');
INSERT INTO public.tim_department_schedule_assignments VALUES (13, 13, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.947829', '2026-08-01 04:38:06.947829');
INSERT INTO public.tim_department_schedule_assignments VALUES (14, 14, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.948829', '2026-08-01 04:38:06.948829');
INSERT INTO public.tim_department_schedule_assignments VALUES (15, 15, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.950368', '2026-08-01 04:38:06.950368');
INSERT INTO public.tim_department_schedule_assignments VALUES (16, 16, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.951874', '2026-08-01 04:38:06.951874');
INSERT INTO public.tim_department_schedule_assignments VALUES (17, 17, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.95293', '2026-08-01 04:38:06.95293');
INSERT INTO public.tim_department_schedule_assignments VALUES (18, 18, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.954007', '2026-08-01 04:38:06.954007');
INSERT INTO public.tim_department_schedule_assignments VALUES (19, 19, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.955071', '2026-08-01 04:38:06.955071');
INSERT INTO public.tim_department_schedule_assignments VALUES (20, 20, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.956202', '2026-08-01 04:38:06.956202');
INSERT INTO public.tim_department_schedule_assignments VALUES (21, 21, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.957785', '2026-08-01 04:38:06.957785');
INSERT INTO public.tim_department_schedule_assignments VALUES (22, 22, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.958833', '2026-08-01 04:38:06.958833');
INSERT INTO public.tim_department_schedule_assignments VALUES (23, 23, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.959877', '2026-08-01 04:38:06.959877');
INSERT INTO public.tim_department_schedule_assignments VALUES (24, 24, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.960928', '2026-08-01 04:38:06.960928');
INSERT INTO public.tim_department_schedule_assignments VALUES (25, 25, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.961972', '2026-08-01 04:38:06.961972');
INSERT INTO public.tim_department_schedule_assignments VALUES (26, 26, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.962485', '2026-08-01 04:38:06.962485');
INSERT INTO public.tim_department_schedule_assignments VALUES (27, 27, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.963485', '2026-08-01 04:38:06.963485');
INSERT INTO public.tim_department_schedule_assignments VALUES (28, 28, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.964485', '2026-08-01 04:38:06.964485');
INSERT INTO public.tim_department_schedule_assignments VALUES (29, 29, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.965485', '2026-08-01 04:38:06.965485');
INSERT INTO public.tim_department_schedule_assignments VALUES (30, 30, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.966485', '2026-08-01 04:38:06.966485');
INSERT INTO public.tim_department_schedule_assignments VALUES (31, 31, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.968485', '2026-08-01 04:38:06.968485');
INSERT INTO public.tim_department_schedule_assignments VALUES (32, 32, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.969487', '2026-08-01 04:38:06.969487');
INSERT INTO public.tim_department_schedule_assignments VALUES (33, 33, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.970486', '2026-08-01 04:38:06.970486');
INSERT INTO public.tim_department_schedule_assignments VALUES (34, 34, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.971487', '2026-08-01 04:38:06.971487');
INSERT INTO public.tim_department_schedule_assignments VALUES (35, 35, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.972485', '2026-08-01 04:38:06.972485');
INSERT INTO public.tim_department_schedule_assignments VALUES (36, 36, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.973485', '2026-08-01 04:38:06.973485');
INSERT INTO public.tim_department_schedule_assignments VALUES (37, 37, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.974484', '2026-08-01 04:38:06.974484');
INSERT INTO public.tim_department_schedule_assignments VALUES (38, 38, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.975484', '2026-08-01 04:38:06.975484');
INSERT INTO public.tim_department_schedule_assignments VALUES (39, 39, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.976485', '2026-08-01 04:38:06.976485');
INSERT INTO public.tim_department_schedule_assignments VALUES (40, 40, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.977485', '2026-08-01 04:38:06.977485');
INSERT INTO public.tim_department_schedule_assignments VALUES (41, 41, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.978886', '2026-08-01 04:38:06.978886');
INSERT INTO public.tim_department_schedule_assignments VALUES (42, 42, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.979887', '2026-08-01 04:38:06.979887');
INSERT INTO public.tim_department_schedule_assignments VALUES (43, 43, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.980887', '2026-08-01 04:38:06.980887');
INSERT INTO public.tim_department_schedule_assignments VALUES (44, 44, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.981887', '2026-08-01 04:38:06.981887');
INSERT INTO public.tim_department_schedule_assignments VALUES (45, 45, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.982887', '2026-08-01 04:38:06.982887');
INSERT INTO public.tim_department_schedule_assignments VALUES (46, 46, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.983888', '2026-08-01 04:38:06.983888');
INSERT INTO public.tim_department_schedule_assignments VALUES (47, 47, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.985581', '2026-08-01 04:38:06.985581');
INSERT INTO public.tim_department_schedule_assignments VALUES (48, 48, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.986095', '2026-08-01 04:38:06.986095');
INSERT INTO public.tim_department_schedule_assignments VALUES (49, 49, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.987095', '2026-08-01 04:38:06.987095');
INSERT INTO public.tim_department_schedule_assignments VALUES (50, 50, 1, '2026-01-01', NULL, 100, true, '2026-08-01 04:38:06.989094', '2026-08-01 04:38:06.989094');


--
-- Data for Name: tim_employee_daily_schedules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_employee_schedule_exceptions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_holidays; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_holidays VALUES (1, '2025-01-01', '신정', 'legal', true, '2026-08-01 04:38:06.992513', '2026-08-01 04:38:06.992513');
INSERT INTO public.tim_holidays VALUES (2, '2025-01-28', '설날 전날', 'legal', true, '2026-08-01 04:38:06.994514', '2026-08-01 04:38:06.994514');
INSERT INTO public.tim_holidays VALUES (3, '2025-01-29', '설날', 'legal', true, '2026-08-01 04:38:06.995515', '2026-08-01 04:38:06.995515');
INSERT INTO public.tim_holidays VALUES (4, '2025-01-30', '설날 다음날', 'legal', true, '2026-08-01 04:38:06.996515', '2026-08-01 04:38:06.996515');
INSERT INTO public.tim_holidays VALUES (5, '2025-03-01', '삼일절', 'legal', true, '2026-08-01 04:38:06.997515', '2026-08-01 04:38:06.997515');
INSERT INTO public.tim_holidays VALUES (6, '2025-05-05', '어린이날', 'legal', true, '2026-08-01 04:38:06.999373', '2026-08-01 04:38:06.999373');
INSERT INTO public.tim_holidays VALUES (7, '2025-05-06', '대체공휴일(석가탄신일)', 'substitute', true, '2026-08-01 04:38:07.000374', '2026-08-01 04:38:07.000374');
INSERT INTO public.tim_holidays VALUES (8, '2025-05-15', '석가탄신일', 'legal', true, '2026-08-01 04:38:07.001961', '2026-08-01 04:38:07.001961');
INSERT INTO public.tim_holidays VALUES (9, '2025-06-06', '현충일', 'legal', true, '2026-08-01 04:38:07.002494', '2026-08-01 04:38:07.002494');
INSERT INTO public.tim_holidays VALUES (10, '2025-08-15', '광복절', 'legal', true, '2026-08-01 04:38:07.003473', '2026-08-01 04:38:07.003473');
INSERT INTO public.tim_holidays VALUES (11, '2025-10-03', '개천절', 'legal', true, '2026-08-01 04:38:07.004473', '2026-08-01 04:38:07.004473');
INSERT INTO public.tim_holidays VALUES (12, '2025-10-05', '추석 전날', 'legal', true, '2026-08-01 04:38:07.005498', '2026-08-01 04:38:07.005498');
INSERT INTO public.tim_holidays VALUES (13, '2025-10-06', '추석', 'legal', true, '2026-08-01 04:38:07.007327', '2026-08-01 04:38:07.007327');
INSERT INTO public.tim_holidays VALUES (14, '2025-10-07', '추석 다음날', 'legal', true, '2026-08-01 04:38:07.008326', '2026-08-01 04:38:07.008326');
INSERT INTO public.tim_holidays VALUES (15, '2025-10-08', '대체공휴일(추석)', 'substitute', true, '2026-08-01 04:38:07.009327', '2026-08-01 04:38:07.009327');
INSERT INTO public.tim_holidays VALUES (16, '2025-10-09', '한글날', 'legal', true, '2026-08-01 04:38:07.009327', '2026-08-01 04:38:07.009327');
INSERT INTO public.tim_holidays VALUES (17, '2025-12-25', '크리스마스', 'legal', true, '2026-08-01 04:38:07.010327', '2026-08-01 04:38:07.010327');
INSERT INTO public.tim_holidays VALUES (18, '2026-01-01', '신정', 'legal', true, '2026-08-01 04:38:07.011327', '2026-08-01 04:38:07.011327');
INSERT INTO public.tim_holidays VALUES (19, '2026-02-16', '설날 전날', 'legal', true, '2026-08-01 04:38:07.012868', '2026-08-01 04:38:07.012868');
INSERT INTO public.tim_holidays VALUES (20, '2026-02-17', '설날', 'legal', true, '2026-08-01 04:38:07.013286', '2026-08-01 04:38:07.013286');
INSERT INTO public.tim_holidays VALUES (21, '2026-02-18', '설날 다음날', 'legal', true, '2026-08-01 04:38:07.014286', '2026-08-01 04:38:07.014286');
INSERT INTO public.tim_holidays VALUES (22, '2026-03-01', '삼일절', 'legal', true, '2026-08-01 04:38:07.015286', '2026-08-01 04:38:07.015286');
INSERT INTO public.tim_holidays VALUES (23, '2026-03-02', '대체공휴일(삼일절)', 'substitute', true, '2026-08-01 04:38:07.016286', '2026-08-01 04:38:07.016286');
INSERT INTO public.tim_holidays VALUES (24, '2026-05-05', '어린이날', 'legal', true, '2026-08-01 04:38:07.017845', '2026-08-01 04:38:07.017845');
INSERT INTO public.tim_holidays VALUES (25, '2026-05-24', '석가탄신일', 'legal', true, '2026-08-01 04:38:07.018842', '2026-08-01 04:38:07.018842');
INSERT INTO public.tim_holidays VALUES (26, '2026-05-25', '대체공휴일(석가탄신일)', 'substitute', true, '2026-08-01 04:38:07.019863', '2026-08-01 04:38:07.019863');
INSERT INTO public.tim_holidays VALUES (27, '2026-06-06', '현충일', 'legal', true, '2026-08-01 04:38:07.020275', '2026-08-01 04:38:07.020275');
INSERT INTO public.tim_holidays VALUES (28, '2026-08-15', '광복절', 'legal', true, '2026-08-01 04:38:07.021277', '2026-08-01 04:38:07.021277');
INSERT INTO public.tim_holidays VALUES (29, '2026-09-24', '추석 전날', 'legal', true, '2026-08-01 04:38:07.022279', '2026-08-01 04:38:07.022279');
INSERT INTO public.tim_holidays VALUES (30, '2026-09-25', '추석', 'legal', true, '2026-08-01 04:38:07.023278', '2026-08-01 04:38:07.023278');
INSERT INTO public.tim_holidays VALUES (31, '2026-09-26', '추석 다음날', 'legal', true, '2026-08-01 04:38:07.024278', '2026-08-01 04:38:07.024278');
INSERT INTO public.tim_holidays VALUES (32, '2026-10-03', '개천절', 'legal', true, '2026-08-01 04:38:07.025278', '2026-08-01 04:38:07.025278');
INSERT INTO public.tim_holidays VALUES (33, '2026-10-05', '대체공휴일(개천절)', 'substitute', true, '2026-08-01 04:38:07.0263', '2026-08-01 04:38:07.0263');
INSERT INTO public.tim_holidays VALUES (34, '2026-10-09', '한글날', 'legal', true, '2026-08-01 04:38:07.02716', '2026-08-01 04:38:07.02716');
INSERT INTO public.tim_holidays VALUES (35, '2026-12-25', '크리스마스', 'legal', true, '2026-08-01 04:38:07.028161', '2026-08-01 04:38:07.028161');


--
-- Data for Name: tim_leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_month_closes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tim_schedule_pattern_days; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_schedule_pattern_days VALUES (1, 1, 0, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (2, 1, 1, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (3, 1, 2, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (4, 1, 3, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (5, 1, 4, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (6, 1, 5, false, NULL, NULL, 0, 0, false);
INSERT INTO public.tim_schedule_pattern_days VALUES (7, 1, 6, false, NULL, NULL, 0, 0, false);


--
-- Data for Name: tim_work_schedule_codes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tim_work_schedule_codes VALUES (1, 'WS01', '주간근무(표준)', '09:00', '18:00', 60, false, 8, true, 10, NULL, '2026-08-01 04:38:06.899263', '2026-08-01 04:38:06.899263');
INSERT INTO public.tim_work_schedule_codes VALUES (2, 'WS02', '주간근무(탄력)', '08:00', '17:00', 60, false, 8, true, 20, NULL, '2026-08-01 04:38:06.90217', '2026-08-01 04:38:06.90217');
INSERT INTO public.tim_work_schedule_codes VALUES (3, 'WS03', '시차출퇴근(A)', '07:00', '16:00', 60, false, 8, true, 30, NULL, '2026-08-01 04:38:06.90317', '2026-08-01 04:38:06.90317');
INSERT INTO public.tim_work_schedule_codes VALUES (4, 'WS04', '시차출퇴근(B)', '10:00', '19:00', 60, false, 8, true, 40, NULL, '2026-08-01 04:38:06.904169', '2026-08-01 04:38:06.904169');
INSERT INTO public.tim_work_schedule_codes VALUES (5, 'WS05', '야간근무', '22:00', '07:00', 60, true, 8, true, 50, NULL, '2026-08-01 04:38:06.905171', '2026-08-01 04:38:06.905171');
INSERT INTO public.tim_work_schedule_codes VALUES (6, 'WS06', '교대근무(주간)', '06:00', '14:00', 30, false, 7.5, true, 60, NULL, '2026-08-01 04:38:06.90717', '2026-08-01 04:38:06.90717');
INSERT INTO public.tim_work_schedule_codes VALUES (7, 'WS07', '교대근무(야간)', '14:00', '22:00', 30, false, 7.5, true, 70, NULL, '2026-08-01 04:38:06.90817', '2026-08-01 04:38:06.90817');
INSERT INTO public.tim_work_schedule_codes VALUES (8, 'WS08', '유연근무', '06:00', '22:00', 60, false, 8, true, 80, NULL, '2026-08-01 04:38:06.909599', '2026-08-01 04:38:06.909599');


--
-- Data for Name: tra_organizations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_courses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_applications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_histories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_cyber_uploads; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_elearning_windows; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_required_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tra_required_targets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: wel_benefit_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: wel_benefit_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.wel_benefit_types VALUES (1, 'SCHOLARSHIP', '학자금', '/wel/scholarship', false, 'SCHOLARSHIP_GRANT', true, 10, '2026-08-01 04:38:07.326318', '2026-08-01 04:38:07.326318');
INSERT INTO public.wel_benefit_types VALUES (2, 'CONDOLENCE', '경조금', '/wel/condolence', false, 'CONDOLENCE_GRANT', true, 20, '2026-08-01 04:38:07.326318', '2026-08-01 04:38:07.326318');
INSERT INTO public.wel_benefit_types VALUES (3, 'MEDICAL', '의료비', '/wel/medical', false, 'MEDICAL_GRANT', true, 30, '2026-08-01 04:38:07.326318', '2026-08-01 04:38:07.326318');
INSERT INTO public.wel_benefit_types VALUES (4, 'LOAN', '사내대출', '/wel/loan', true, 'LOAN_REPAY', true, 40, '2026-08-01 04:38:07.326318', '2026-08-01 04:38:07.326318');
INSERT INTO public.wel_benefit_types VALUES (5, 'PENSION', '개인연금', '/wel/pension', true, 'PENSION_DEDUCT', true, 50, '2026-08-01 04:38:07.327318', '2026-08-01 04:38:07.327318');
INSERT INTO public.wel_benefit_types VALUES (6, 'RESORT', '리조트', '/wel/resort', false, NULL, true, 60, '2026-08-01 04:38:07.327404', '2026-08-01 04:38:07.327404');
INSERT INTO public.wel_benefit_types VALUES (7, 'CLUB', '동호회', '/wel/club', true, 'CLUB_DEDUCT', true, 70, '2026-08-01 04:38:07.327404', '2026-08-01 04:38:07.327404');
INSERT INTO public.wel_benefit_types VALUES (8, 'HEALTH_CHECK', '건강검진', '/wel/health-check', false, NULL, true, 80, '2026-08-01 04:38:07.327404', '2026-08-01 04:38:07.327404');


--
-- Name: PAP_APPRAISAL_MASTERS_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PAP_APPRAISAL_MASTERS_id_seq"', 2, true);


--
-- Name: PAP_FINAL_RESULTS_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PAP_FINAL_RESULTS_id_seq"', 4, true);


--
-- Name: app_code_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_code_groups_id_seq', 16, true);


--
-- Name: app_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_codes_id_seq', 55, true);


--
-- Name: app_menu_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_menu_actions_id_seq', 602, true);


--
-- Name: app_menus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_menus_id_seq', 115, true);


--
-- Name: app_role_menu_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_role_menu_actions_id_seq', 1, false);


--
-- Name: app_system_setting_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_system_setting_history_id_seq', 1, false);


--
-- Name: app_system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_system_settings_id_seq', 5, true);


--
-- Name: auth_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_roles_id_seq', 4, true);


--
-- Name: auth_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_users_id_seq', 1, false);


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gl_accounts_id_seq', 13, true);


--
-- Name: hr_appointment_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_appointment_order_items_id_seq', 1, false);


--
-- Name: hr_appointment_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_appointment_orders_id_seq', 1, false);


--
-- Name: hr_careers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_careers_id_seq', 1, false);


--
-- Name: hr_contact_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_contact_points_id_seq', 1, false);


--
-- Name: hr_employee_basic_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_employee_basic_profiles_id_seq', 1, false);


--
-- Name: hr_employee_info_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_employee_info_records_id_seq', 1, false);


--
-- Name: hr_employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_employees_id_seq', 1, false);


--
-- Name: hr_licenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_licenses_id_seq', 1, false);


--
-- Name: hr_military_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_military_id_seq', 1, false);


--
-- Name: hr_personnel_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_personnel_histories_id_seq', 1, false);


--
-- Name: hr_recruit_finalists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_recruit_finalists_id_seq', 1, false);


--
-- Name: hr_retire_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_retire_audit_logs_id_seq', 1, false);


--
-- Name: hr_retire_case_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_retire_case_items_id_seq', 1, false);


--
-- Name: hr_retire_cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_retire_cases_id_seq', 1, false);


--
-- Name: hr_retire_checklist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_retire_checklist_items_id_seq', 4, true);


--
-- Name: hr_reward_punish_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_reward_punish_id_seq', 1, false);


--
-- Name: hr_severance_calcs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_severance_calcs_id_seq', 1, false);


--
-- Name: hri_approval_actor_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_approval_actor_rules_id_seq', 4, true);


--
-- Name: hri_approval_line_steps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_approval_line_steps_id_seq', 12, true);


--
-- Name: hri_approval_line_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_approval_line_templates_id_seq', 4, true);


--
-- Name: hri_form_type_approval_maps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_form_type_approval_maps_id_seq', 5, true);


--
-- Name: hri_form_type_policies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_form_type_policies_id_seq', 15, true);


--
-- Name: hri_form_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_form_types_id_seq', 5, true);


--
-- Name: hri_req_cert_employment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_req_cert_employment_id_seq', 1, false);


--
-- Name: hri_req_leave_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_req_leave_id_seq', 1, false);


--
-- Name: hri_req_tim_attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_req_tim_attendance_id_seq', 1, false);


--
-- Name: hri_req_tim_correction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_req_tim_correction_id_seq', 1, false);


--
-- Name: hri_request_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_request_attachments_id_seq', 1, false);


--
-- Name: hri_request_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_request_histories_id_seq', 1, false);


--
-- Name: hri_request_masters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_request_masters_id_seq', 1, false);


--
-- Name: hri_request_step_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hri_request_step_snapshots_id_seq', 1, false);


--
-- Name: mng_companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_companies_id_seq', 1, false);


--
-- Name: mng_dev_inquiries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_dev_inquiries_id_seq', 1, false);


--
-- Name: mng_dev_projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_dev_projects_id_seq', 1, false);


--
-- Name: mng_dev_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_dev_requests_id_seq', 1, false);


--
-- Name: mng_infra_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_infra_configs_id_seq', 1, false);


--
-- Name: mng_infra_masters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_infra_masters_id_seq', 1, false);


--
-- Name: mng_manager_companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_manager_companies_id_seq', 1, false);


--
-- Name: mng_outsource_attendances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_outsource_attendances_id_seq', 1, false);


--
-- Name: mng_outsource_contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mng_outsource_contracts_id_seq', 1, false);


--
-- Name: org_corporations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_corporations_id_seq', 1, true);


--
-- Name: org_departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_departments_id_seq', 50, true);


--
-- Name: org_dept_change_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_dept_change_histories_id_seq', 1, false);


--
-- Name: org_mapping_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_mapping_assignments_id_seq', 1, false);


--
-- Name: org_mapping_type_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_mapping_type_items_id_seq', 1, false);


--
-- Name: org_restructure_plan_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_restructure_plan_items_id_seq', 1, false);


--
-- Name: org_restructure_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_restructure_plans_id_seq', 1, false);


--
-- Name: pap_appraisal_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pap_appraisal_targets_id_seq', 1, false);


--
-- Name: pay_allowance_deductions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_allowance_deductions_id_seq', 20, true);


--
-- Name: pay_employee_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_employee_profiles_id_seq', 1, false);


--
-- Name: pay_gl_mappings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_gl_mappings_id_seq', 20, true);


--
-- Name: pay_income_tax_brackets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_income_tax_brackets_id_seq', 16, true);


--
-- Name: pay_item_group_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_item_group_details_id_seq', 1, false);


--
-- Name: pay_item_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_item_groups_id_seq', 2, true);


--
-- Name: pay_payroll_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_codes_id_seq', 3, true);


--
-- Name: pay_payroll_run_employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_run_employees_id_seq', 1, false);


--
-- Name: pay_payroll_run_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_run_events_id_seq', 1, false);


--
-- Name: pay_payroll_run_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_run_items_id_seq', 1, false);


--
-- Name: pay_payroll_run_target_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_run_target_events_id_seq', 1, false);


--
-- Name: pay_payroll_run_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_run_targets_id_seq', 1, false);


--
-- Name: pay_payroll_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_payroll_runs_id_seq', 1, false);


--
-- Name: pay_severance_item_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_severance_item_rules_id_seq', 20, true);


--
-- Name: pay_tax_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_tax_rates_id_seq', 8, true);


--
-- Name: pay_variable_inputs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_variable_inputs_id_seq', 1, false);


--
-- Name: pay_voucher_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_voucher_lines_id_seq', 1, false);


--
-- Name: pay_vouchers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pay_vouchers_id_seq', 1, false);


--
-- Name: tim_annual_leaves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_annual_leaves_id_seq', 1, false);


--
-- Name: tim_attendance_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_attendance_codes_id_seq', 18, true);


--
-- Name: tim_attendance_corrections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_attendance_corrections_id_seq', 1, false);


--
-- Name: tim_attendance_daily_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_attendance_daily_id_seq', 1, false);


--
-- Name: tim_department_schedule_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_department_schedule_assignments_id_seq', 50, true);


--
-- Name: tim_employee_daily_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_employee_daily_schedules_id_seq', 1, false);


--
-- Name: tim_employee_schedule_exceptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_employee_schedule_exceptions_id_seq', 1, false);


--
-- Name: tim_holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_holidays_id_seq', 35, true);


--
-- Name: tim_leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_leave_requests_id_seq', 1, false);


--
-- Name: tim_month_closes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_month_closes_id_seq', 1, false);


--
-- Name: tim_schedule_pattern_days_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_schedule_pattern_days_id_seq', 7, true);


--
-- Name: tim_schedule_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_schedule_patterns_id_seq', 1, true);


--
-- Name: tim_work_schedule_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tim_work_schedule_codes_id_seq', 8, true);


--
-- Name: tra_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_applications_id_seq', 1, false);


--
-- Name: tra_courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_courses_id_seq', 1, false);


--
-- Name: tra_cyber_uploads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_cyber_uploads_id_seq', 1, false);


--
-- Name: tra_elearning_windows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_elearning_windows_id_seq', 1, false);


--
-- Name: tra_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_events_id_seq', 1, false);


--
-- Name: tra_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_histories_id_seq', 1, false);


--
-- Name: tra_organizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_organizations_id_seq', 1, false);


--
-- Name: tra_required_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_required_rules_id_seq', 1, false);


--
-- Name: tra_required_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tra_required_targets_id_seq', 1, false);


--
-- Name: wel_benefit_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wel_benefit_requests_id_seq', 1, false);


--
-- Name: wel_benefit_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wel_benefit_types_id_seq', 8, true);


--
-- PostgreSQL database dump complete
--

\unrestrict BhML4YvMFOdCVX0mUNK8E4nZZSEwISDevHfcTf3YjkTP3haAQBFDj3wYKnYNSq6

