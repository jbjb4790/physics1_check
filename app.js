function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function lessonUrl(id) { return `lesson.html?session=${id}`; }
function currentBaseUrl() {
  return window.location.href.replace(/[^/]*$/, '');
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}

function renderIndex() {
  const grid = qs('#lessonGrid');
  const search = qs('#searchInput');
  const filter = qs('#unitFilter');
  function draw() {
    const term = (search.value || '').trim().toLowerCase();
    const unit = filter.value;
    const items = window.LESSONS.filter(lesson => {
      const hay = [lesson.id, lesson.unit, lesson.title, lesson.subtitle, lesson.textbook, ...lesson.goals, ...lesson.formulas.map(f=>`${f.name} ${f.body} ${f.tip}`)].join(' ').toLowerCase();
      return (unit === 'all' || lesson.unit === unit) && (!term || hay.includes(term));
    });
    grid.innerHTML = items.map(lesson => {
      const saved = JSON.parse(localStorage.getItem(`physics-check-session-${lesson.id}`) || 'null');
      const savedBadge = saved ? `<span class="badge good">최근 ${saved.score}/${saved.total}</span>` : `<span class="badge">미진행</span>`;
      return `<article class="lesson-card">
        <div class="card-top"><span class="session-num">${lesson.id}회차</span><span class="unit-pill">${escapeHtml(lesson.unit)}</span></div>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p>${escapeHtml(lesson.subtitle)}</p>
        <p class="textbook">${escapeHtml(lesson.textbook)}</p>
        <div class="card-badges">${savedBadge}<span class="badge">문항 ${lesson.questions.length}개</span><span class="badge">O/X ${lesson.misconceptions.length}개</span></div>
        <div class="card-actions">
          <a class="button primary" href="${lessonUrl(lesson.id)}">진단 열기</a>
          <button class="button copy-link" data-id="${lesson.id}">링크 복사</button>
        </div>
      </article>`;
    }).join('') || `<p class="empty">검색 결과가 없습니다.</p>`;
    qsa('.copy-link').forEach(btn => btn.addEventListener('click', () => {
      const url = new URL(lessonUrl(btn.dataset.id), window.location.href).href;
      copyText(url).then(() => {
        btn.textContent = '복사됨!';
        setTimeout(() => btn.textContent = '링크 복사', 1200);
      });
    }));
  }
  search.addEventListener('input', draw);
  filter.addEventListener('change', draw);
  draw();
}

function getLessonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('session') || '1');
  return window.LESSONS.find(l => l.id === id) || window.LESSONS[0];
}

function renderLessonPage() {
  const lesson = getLessonFromUrl();
  document.title = `${lesson.id}회차 · ${lesson.title}`;
  renderLessonHeader(lesson);
  renderGoals(lesson);
  renderFormulas(lesson);
  renderMisconceptions(lesson);
  renderQuiz(lesson);
  renderLessonNav(lesson);
}

function renderLessonHeader(lesson) {
  qs('#lessonHeader').innerHTML = `<p class="eyebrow">${escapeHtml(lesson.unit)} · ${lesson.id}회차</p>
    <h1>${escapeHtml(lesson.title)}</h1>
    <p class="lead">${escapeHtml(lesson.subtitle)}</p>
    <p class="textbook">${escapeHtml(lesson.textbook)}</p>
    <div class="header-actions">
      <button class="button" id="copyCurrentLink">이 회차 링크 복사</button>
      <button class="button" id="printPage">인쇄/PDF 저장</button>
    </div>`;
  qs('#copyCurrentLink').addEventListener('click', () => copyText(window.location.href).then(() => qs('#copyCurrentLink').textContent = '복사됨!'));
  qs('#printPage').addEventListener('click', () => window.print());
}

function renderGoals(lesson) {
  qs('#goalsBox').innerHTML = `<h2>오늘 확인할 핵심 개념</h2>
    <ul class="check-list">${lesson.goals.map(g => `<li>${escapeHtml(g)}</li>`).join('')}</ul>`;
}

function renderFormulas(lesson) {
  qs('#formulaBox').innerHTML = `<h2>공식 카드</h2>
    <div class="formula-grid">${lesson.formulas.map(f => `<article class="formula-card">
      <h3>${escapeHtml(f.name)}</h3>
      <div class="formula">${escapeHtml(f.body)}</div>
      <p>${escapeHtml(f.tip)}</p>
    </article>`).join('')}</div>`;
}

function renderMisconceptions(lesson) {
  qs('#misconceptionBox').innerHTML = `<h2>오개념 O/X 체크</h2>
    <p class="small">문장을 읽고 맞으면 O, 틀리면 X를 고르세요.</p>
    <div class="mis-list">${lesson.misconceptions.map((m, idx) => `<div class="mis-item" data-index="${idx}">
      <p><strong>${idx+1}.</strong> ${escapeHtml(m.claim)}</p>
      <label><input type="radio" name="mis-${idx}" value="true"> O</label>
      <label><input type="radio" name="mis-${idx}" value="false"> X</label>
      <div class="feedback hidden"></div>
    </div>`).join('')}</div>`;
}

function renderQuiz(lesson) {
  qs('#quizBox').innerHTML = `<h2>5분 진단 문항</h2>
    <form id="quizForm">
      ${lesson.questions.map((q, idx) => `<fieldset class="question" data-index="${idx}">
        <legend>${idx+1}. ${escapeHtml(q.prompt)}</legend>
        ${q.choices.map((choice, cidx) => `<label class="choice"><input type="radio" name="q-${idx}" value="${cidx}"> <span>${escapeHtml(choice)}</span></label>`).join('')}
        <div class="feedback hidden"></div>
      </fieldset>`).join('')}
      <div class="submit-row">
        <button class="button primary large" type="submit">채점하고 오개념 확인</button>
        <button class="button large" type="button" id="resetAnswers">답안 초기화</button>
      </div>
    </form>`;
  qs('#quizForm').addEventListener('submit', e => {
    e.preventDefault();
    gradeLesson(lesson);
  });
  qs('#resetAnswers').addEventListener('click', () => {
    qsa('input[type=radio]').forEach(input => input.checked = false);
    qsa('.feedback').forEach(f => { f.className = 'feedback hidden'; f.textContent = ''; });
    qs('#resultBox').classList.add('hidden');
  });
}

function gradeLesson(lesson) {
  let score = 0;
  let total = lesson.questions.length + lesson.misconceptions.length;
  const weakTags = [];
  let unanswered = 0;

  lesson.misconceptions.forEach((m, idx) => {
    const box = qs(`.mis-item[data-index="${idx}"]`);
    const picked = qs(`input[name="mis-${idx}"]:checked`);
    const feedback = qs('.feedback', box);
    if (!picked) {
      unanswered += 1;
      feedback.className = 'feedback warn';
      feedback.textContent = '아직 선택하지 않았습니다.';
      weakTags.push(m.tag);
      return;
    }
    const value = picked.value === 'true';
    if (value === m.answer) {
      score += 1;
      feedback.className = 'feedback correct';
      feedback.textContent = `정답입니다. ${m.feedback}`;
    } else {
      feedback.className = 'feedback incorrect';
      feedback.textContent = `다시 확인하세요. ${m.feedback}`;
      weakTags.push(m.tag);
    }
  });

  lesson.questions.forEach((q, idx) => {
    const field = qs(`.question[data-index="${idx}"]`);
    const picked = qs(`input[name="q-${idx}"]:checked`);
    const feedback = qs('.feedback', field);
    if (!picked) {
      unanswered += 1;
      feedback.className = 'feedback warn';
      feedback.textContent = '아직 선택하지 않았습니다.';
      weakTags.push(q.tag);
      return;
    }
    const value = Number(picked.value);
    if (value === q.answer) {
      score += 1;
      feedback.className = 'feedback correct';
      feedback.textContent = `정답입니다. ${q.explain}`;
    } else {
      feedback.className = 'feedback incorrect';
      feedback.textContent = `오답입니다. 정답: ${q.choices[q.answer]} · ${q.explain}`;
      weakTags.push(q.tag);
    }
  });

  const name = qs('#studentName').value.trim() || '이름 미입력';
  const uniqueTags = [...new Set(weakTags)].filter(Boolean);
  const percent = Math.round((score/total)*100);
  const level = percent >= 85 ? '안정' : percent >= 65 ? '부분 이해' : '재학습 필요';
  const now = new Date().toLocaleString('ko-KR');
  const report = [
    `[물리Ⅰ ${lesson.id}회차 자기점검 리포트]`,
    `이름: ${name}`,
    `회차: ${lesson.id}회차 ${lesson.title}`,
    `점수: ${score}/${total} (${percent}%)`,
    `판정: ${level}`,
    `미응답: ${unanswered}개`,
    `복습 우선순위: ${uniqueTags.length ? uniqueTags.join(', ') : '없음'}`,
    `완료 시각: ${now}`
  ].join('\n');

  localStorage.setItem(`physics-check-session-${lesson.id}`, JSON.stringify({score, total, percent, level, tags: uniqueTags, at: now}));
  const result = qs('#resultBox');
  result.classList.remove('hidden');
  result.innerHTML = `<h2>결과</h2>
    <div class="score-circle" aria-label="점수"><span>${score}</span><small>/${total}</small></div>
    <p class="result-level"><strong>${level}</strong> · ${percent}%</p>
    <p>${unanswered ? `미응답 ${unanswered}개가 있습니다. 다시 풀면 더 정확한 진단이 됩니다.` : '모든 문항에 응답했습니다.'}</p>
    <h3>복습 우선순위</h3>
    <div class="tag-list">${uniqueTags.length ? uniqueTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') : '<span class="tag good">현재 뚜렷한 약점 태그 없음</span>'}</div>
    <textarea id="reportText" readonly>${escapeHtml(report)}</textarea>
    <div class="submit-row">
      <button class="button primary" id="copyReport" type="button">리포트 복사</button>
      <button class="button" id="downloadReport" type="button">txt로 저장</button>
    </div>`;
  qs('#copyReport').addEventListener('click', () => copyText(report).then(() => qs('#copyReport').textContent = '복사됨!'));
  qs('#downloadReport').addEventListener('click', () => {
    const blob = new Blob([report], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `physics-session-${lesson.id}-report.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  result.scrollIntoView({behavior:'smooth', block:'start'});
}

function renderLessonNav(lesson) {
  const prev = qs('#prevLesson');
  const next = qs('#nextLesson');
  const prevId = lesson.id - 1;
  const nextId = lesson.id + 1;
  if (prevId >= 1) { prev.href = lessonUrl(prevId); prev.textContent = `${prevId}회차`; } else { prev.classList.add('disabled'); prev.href = 'index.html'; prev.textContent = '첫 회차'; }
  if (nextId <= window.LESSONS.length) { next.href = lessonUrl(nextId); next.textContent = `${nextId}회차`; } else { next.classList.add('disabled'); next.href = 'index.html'; next.textContent = '마지막 회차'; }
}

function renderTeacherLinks() {
  const wrap = qs('#teacherLinks');
  const base = currentBaseUrl();
  wrap.innerHTML = window.LESSONS.map(lesson => {
    const url = new URL(lessonUrl(lesson.id), base).href;
    return `<div class="teacher-link-row">
      <span><strong>${lesson.id}회차</strong> ${escapeHtml(lesson.title)}</span>
      <code>${escapeHtml(url)}</code>
      <button class="button copy-teacher" data-url="${escapeHtml(url)}">복사</button>
    </div>`;
  }).join('');
  qsa('.copy-teacher').forEach(btn => btn.addEventListener('click', () => copyText(btn.dataset.url).then(() => {
    btn.textContent = '복사됨!';
    setTimeout(() => btn.textContent = '복사', 1200);
  })));
}
