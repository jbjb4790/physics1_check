# 물리Ⅰ 회차별 개념·공식·오개념 체크 사이트

이 폴더는 GitHub Pages에 바로 올릴 수 있는 무료 정적 HTML 사이트입니다.

## 포함 파일

- `index.html`: 전체 회차 목록
- `lesson.html`: 학생이 푸는 회차별 진단 페이지
- `teacher.html`: GitHub Pages 업로드 안내 및 회차 링크 복사 화면
- `data.js`: 17회차 수업 데이터, 공식 카드, 오개념 O/X, 진단 문항
- `app.js`: 채점, 피드백, 리포트 생성 기능
- `styles.css`: 디자인

## 무료 배포 방법

1. GitHub에서 새 저장소를 만듭니다. 예: `physics-check`
2. 이 폴더의 파일을 저장소 최상위(root)에 업로드합니다.
3. 저장소의 `Settings → Pages`로 이동합니다.
4. `Deploy from a branch`, branch는 `main`, folder는 `/(root)`를 선택하고 저장합니다.
5. 몇 분 후 아래 주소가 열립니다.

```text
https://깃허브아이디.github.io/physics-check/
```

회차별 링크는 다음과 같습니다.

```text
https://깃허브아이디.github.io/physics-check/lesson.html?session=1
https://깃허브아이디.github.io/physics-check/lesson.html?session=2
...
https://깃허브아이디.github.io/physics-check/lesson.html?session=17
```

## 학생 답안 수집

이 사이트는 GitHub Pages에서 무료로 작동하도록 서버가 없습니다. 따라서 자동 채점과 피드백은 가능하지만 학생 답안을 중앙에 자동 저장하지 않습니다.
학생은 결과 화면에서 `리포트 복사` 또는 `txt로 저장`을 눌러 선생님께 제출할 수 있습니다.

## 문항 수정 방법

`data.js`에서 원하는 회차의 `questions`, `misconceptions`, `formulas` 항목을 수정하면 됩니다.

- `answer`는 정답 번호입니다. 객관식 선택지는 0번부터 시작합니다.
- O/X 문항의 `answer`는 `true`가 O, `false`가 X입니다.
- `tag`는 오답 리포트에서 복습 우선순위로 표시됩니다.

## 운영 팁

- 수업 종료 5분 전: 공식 카드 1분 → O/X 2분 → 진단 문항 2분
- 결과 리포트의 복습 태그를 다음 수업 도입 질문으로 사용
- 단원평가 전에는 1회차부터 누적 복습 링크를 순서대로 제공
