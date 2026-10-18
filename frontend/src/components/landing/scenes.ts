export type ProductScene = {
  id: string;
  title: string;
  category: string;
  description: string;
  detail: string;
  image: string;
};

export const PRODUCT_SCENES: readonly ProductScene[] = [
  { id: "01", title: "사원관리", category: "인사", description: "구성원 정보를 한눈에, 변경은 한 번에.", detail: "검색으로 대상을 좁히고 여러 행을 편집합니다. 저장 전 변경 건수를 확인하고 한 번에 반영합니다.", image: "/images/product/01.webp" },
  { id: "02", title: "인사기본", category: "인사", description: "한 사람의 정보를 맥락 있게.", detail: "구성원 요약부터 기본 정보까지 이어서 확인하고, 필요한 항목을 수정한 뒤 명시적으로 저장합니다.", image: "/images/product/02.webp" },
  { id: "03", title: "인사 이력", category: "인사", description: "쌓이는 이력에도 같은 편집 경험.", detail: "학력, 경력, 발령 등 이력을 공통 그리드에서 관리합니다. 삭제 표시도 저장 전에는 되돌릴 수 있습니다.", image: "/images/product/03.webp" },
  { id: "04", title: "결재 상세", category: "결재", description: "목록과 문서를 오가지 않아도 되도록.", detail: "처리할 문서와 결재 내용을 나란히 확인합니다. 승인과 반려는 내용을 검토한 뒤 별도의 확인 절차로 진행합니다.", image: "/images/product/04.webp" },
  { id: "05", title: "조직도", category: "조직", description: "조직의 연결을 넓게 살펴보세요.", detail: "부서 간 구조와 인원 정보를 함께 보고, 선택한 조직의 위치와 관계를 확인합니다.", image: "/images/product/05.webp" },
  { id: "06", title: "근무 배정", category: "근태", description: "조직의 기준과 개인의 예외를 함께.", detail: "부서별 근무패턴과 개인별 예외를 기간 단위로 관리합니다. 배정 변경은 초안으로 모아 저장합니다.", image: "/images/product/06.webp" },
  { id: "07", title: "근태 현황", category: "근태", description: "날짜와 상태로 읽는 하루의 기록.", detail: "기간별 출퇴근과 휴가 상태를 조회하고, 확인이 필요한 기록에서 정정 업무로 이어갑니다.", image: "/images/product/07.webp" },
  { id: "08", title: "근태 월마감", category: "근태", description: "열두 달의 상태를 한 화면에서.", detail: "월별 집계와 마감 여부를 비교합니다. 마감과 재오픈은 일반적인 표 편집과 구분된 확인 절차를 거칩니다.", image: "/images/product/08.webp" },
  { id: "09", title: "사람이 중심이 되는 공간", category: "VIBE-HR", description: "물결 위의 VIBE-HR, 커서를 따라 흐르는 글자.", detail: "미리보기에서는 물결과 글자의 움직임을 자동으로 보여드립니다. 확대하면 커서를 움직여 VIBE-HR 글자와 물결을 직접 제어할 수 있습니다.", image: "/images/conservatory-login-desktop.webp" },
  { id: "10", title: "급여 명세서", category: "급여", description: "월별 내역에서 상세 명세까지.", detail: "월별 지급 내역을 선택해 수당과 공제 내용을 확인합니다. 명세서는 읽기 쉬운 문서 형식을 유지합니다.", image: "/images/product/10.webp" },
  { id: "11", title: "급여 실행", category: "급여", description: "실행 상태와 대상자를 함께 확인.", detail: "급여 실행별 계산, 마감, 지급 상태와 대상자를 조회합니다. 실행 건의 집계와 상세 내역을 연결해 확인합니다.", image: "/images/product/11.webp" },
  { id: "12", title: "급여 전표", category: "급여", description: "계정별 근거까지 이어지는 급여.", detail: "전표의 차변과 대변을 계정별로 대조하고 합계를 확인합니다. 전표 라인은 조회 중심 그리드로 제공합니다.", image: "/images/product/12.webp" },
  { id: "13", title: "퇴직금 산정", category: "인사", description: "산정 결과와 근거를 가까이.", detail: "재직 기간, 평균 임금, 산입 항목과 산출 요약을 확인합니다. 세액 요약은 문서의 구조를 유지합니다.", image: "/images/product/13.webp" },
  { id: "14", title: "복리후생", category: "복리후생", description: "신청부터 처리 상태까지 선명하게.", detail: "복리후생 신청의 대상, 금액, 처리 상태를 목록에서 확인하고 필요한 조건으로 조회합니다.", image: "/images/product/14.webp" },
  { id: "15", title: "교육 신청", category: "교육", description: "구성원의 배움도 같은 흐름으로.", detail: "교육 과정과 신청자 정보를 함께 살펴보고 승인할 대상을 확인합니다.", image: "/images/product/15.webp" },
  { id: "16", title: "인사 평가", category: "평가", description: "평가 대상과 변경 내역을 명확하게.", detail: "평가별 대상자를 조회하고 점수와 의견을 관리합니다. 수정 사항은 저장 전에 확인할 수 있습니다.", image: "/images/product/16.webp" },
  { id: "17", title: "운영 설정", category: "시스템", description: "역할에 맞는 메뉴와 작업 권한.", detail: "역할별 메뉴 접근과 작업 권한을 매트릭스로 비교합니다. 권한 변경은 저장을 통해 반영합니다.", image: "/images/product/17.webp" },
];

export const clampScene = (index: number) => Math.max(-1, Math.min(PRODUCT_SCENES.length - 1, index));
