# 물리Ⅰ Check · GitHub Pages + Google Sheets 연동형

첨부 교재의 1~17회차 진도 흐름에 맞춘 수업 후 5분 자기점검 사이트입니다. 학생은 회차별 링크에서 문제를 풀고, 채점 직후 약한 개념 코멘트와 복습 액션을 확인한 뒤 결과를 Google Sheet와 선택적으로 Google Drive 리포트 파일로 제출할 수 있습니다.

## 파일 구성

- `index.html` : 학생용 첫 화면 / 회차 선택
- `lesson.html` : 회차별 진단 화면
- `teacher.html` : Google 저장 설정 안내
- `data.js` : 1~17회차 개념·공식·문항 데이터
- `app.js` : 화면 렌더링, 채점, 제출 기능
- `styles.css` : 디자인
- `config.js` : Google Apps Script Web App URL 설정
- `google-apps-script/Code.gs` : Google Sheet/Drive 저장용 Apps Script 코드
- `google-apps-script.gs` : 같은 코드의 루트 복사본
- `404.html` : 오류 페이지

## GitHub Pages 배포

1. GitHub에서 새 repository를 만듭니다. 예: `physics-check`
2. 이 ZIP의 모든 파일을 repository 최상위에 업로드합니다.
3. `Settings → Pages → Deploy from a branch → main → /(root)`로 설정합니다.
4. 배포 주소 예시: `https://깃허브아이디.github.io/physics-check/`

회차별 링크 예시:

```text
https://깃허브아이디.github.io/physics-check/lesson.html?session=1
https://깃허브아이디.github.io/physics-check/lesson.html?session=2
...
https://깃허브아이디.github.io/physics-check/lesson.html?session=17
```

## Google Sheet 자동 저장 설정

1. Google Sheet를 하나 만듭니다.
2. 상단 메뉴에서 `확장 프로그램 → Apps Script`를 엽니다.
3. `google-apps-script/Code.gs` 전체 코드를 Apps Script의 `Code.gs`에 붙여넣고 저장합니다.
4. `배포 → 새 배포 → 유형: 웹 앱`으로 배포합니다.
5. 실행 권한은 `나`, 액세스 권한은 `Anyone`으로 설정합니다.
6. Web App URL을 복사해 `config.js`의 `SUBMIT_URL`에 붙여넣습니다.
7. 수정된 `config.js`를 GitHub에 다시 업로드합니다.

설정 예시:

```js
window.PHYSICS_CHECK_CONFIG = {
  SUBMIT_URL: "https://script.google.com/macros/s/배포ID/exec",
  CLASS_NAME: "물리Ⅰ",
  AUTO_SUBMIT: true,
  REQUIRE_STUDENT_NAME: true
};
```

학생 제출 후 Sheet에는 `제출결과`, `문항별응답`, `태그집계` 시트가 자동 생성됩니다. `제출결과`에는 점수와 복습 태그뿐 아니라 학생별 약점 코멘트도 함께 저장됩니다. Drive 폴더에도 리포트 txt 파일을 저장하려면 Apps Script 코드 상단의 `DRIVE_FOLDER_ID`에 폴더 ID를 입력하세요.

## 문항 수정

`data.js`에서 각 회차의 `goals`, `formulas`, `misconceptions`, `questions`를 수정하면 됩니다. GitHub에 다시 업로드하면 Pages가 자동 갱신됩니다.

## 2026 업데이트: 공식 선택 문항

각 회차에 `formulaChecks` 데이터가 추가되었습니다. 학생은 맞는 공식과 살짝 틀린 공식이 섞인 보기에서 **올바른 공식만 모두 체크**합니다. 채점 결과에는 공식 구분 약점도 O/X, 객관식과 함께 반영됩니다.

문항을 수정하려면 `data.js`에서 각 회차의 아래 구조를 편집하세요.

```js
formulaChecks: [
  {
    prompt: "등가속도 운동 공식 중 올바른 것만 모두 고르세요.",
    tag: "공식 선택-등가속도",
    options: [
      { text: "v = v₀ + at", correct: true, feedback: "나중 속도 공식입니다." },
      { text: "v = v₀ + 1/2 at²", correct: false, feedback: "단위가 맞지 않습니다." }
    ]
  }
]
```

Google Sheets를 사용하는 경우 새 Apps Script 코드도 다시 붙여넣어야 `문항별응답` 시트에 `Formula` 문항이 함께 저장됩니다.
