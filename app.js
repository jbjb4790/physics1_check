function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function lessonUrl(id) { return `lesson.html?session=${id}`; }
function currentBaseUrl() { return window.location.href.replace(/[^/]*$/, ''); }
function safeJsonParse(value) { try { return JSON.parse(value); } catch (_) { return null; } }
function getSavedResult(id) {
  try { return safeJsonParse(localStorage.getItem(`physics-check-session-${id}`)); }
  catch (_) { return null; }
}
function unitAccent(unit) { return unit === '역학' ? '#0b5fd3' : '#0284c7'; }
function unitIcon(unit) { return unit === '역학' ? '⚙' : '〰'; }
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}
function setButtonCopied(button, text = '복사됨!', original = null) {
  if (!button) return;
  const before = original || button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = before; }, 1200);
}

function getConfig() {
  return window.PHYSICS_CHECK_CONFIG || {};
}
function getAppsScriptUrl() {
  const config = getConfig();
  return String(config.SUBMIT_URL || config.GOOGLE_APPS_SCRIPT_URL || '').trim();
}
function getClassLabel() {
  const config = getConfig();
  return String(config.CLASS_NAME || config.CLASS_LABEL || '물리Ⅰ');
}
function isGoogleSubmitReady() {
  const config = getConfig();
  return Boolean(getAppsScriptUrl()) && config.ENABLE_GOOGLE_SUBMIT !== false;
}
function shouldAutoSubmit() {
  const config = getConfig();
  return config.AUTO_SUBMIT !== false;
}
function isNameRequired() {
  const config = getConfig();
  return config.REQUIRE_STUDENT_NAME !== false;
}
function renderConnectionStatus(targetId = 'connectionStatus') {
  const el = qs(`#${targetId}`);
  if (!el) return;
  if (isGoogleSubmitReady()) {
    el.className = 'connection-pill connected' + (el.classList.contains('compact') ? ' compact' : '');
    el.innerHTML = '<strong>Google 저장 연결됨</strong><span>제출 결과가 Sheet/Drive로 전송됩니다.</span>';
  } else {
    el.className = 'connection-pill not-connected' + (el.classList.contains('compact') ? ' compact' : '');
    el.innerHTML = '<strong>Google 저장 미설정</strong><span>teacher.html에서 Web App URL을 연결하세요.</span>';
  }
}

function renderIndex() {
  renderConnectionStatus('connectionStatus');
  renderProgressSummary();

  const grid = qs('#lessonGrid');
  const search = qs('#searchInput');
  const filter = qs('#unitFilter');
  if (!grid || !search || !filter) return;

  function draw() {
    const term = (search.value || '').trim().toLowerCase();
    const unit = filter.value;
    const items = window.LESSONS.filter(lesson => {
      const hay = [
        lesson.id, lesson.unit, lesson.title, lesson.subtitle, lesson.textbook,
        ...lesson.goals,
        ...lesson.formulas.map(f => `${f.name} ${f.body} ${f.tip}`),
        ...lesson.questions.map(q => `${q.prompt} ${q.choices.join(' ')} ${q.tag}`),
        ...lesson.misconceptions.map(m => `${m.claim} ${m.tag}`)
      ].join(' ').toLowerCase();
      return (unit === 'all' || lesson.unit === unit) && (!term || hay.includes(term));
    });

    grid.innerHTML = items.map(lesson => {
      const saved = getSavedResult(lesson.id);
      const progress = saved ? Math.max(0, Math.min(100, saved.percent || 0)) : 0;
      const savedBadge = saved
        ? `<span class="badge good">최근 ${saved.score}/${saved.total}</span>`
        : `<span class="badge warn">미진행</span>`;
      const totalItems = lesson.questions.length + lesson.misconceptions.length;
      return `<article class="lesson-card" data-icon="${unitIcon(lesson.unit)}" style="--card-accent:${unitAccent(lesson.unit)}; --progress:${progress}%">
        <div class="card-top">
          <span class="session-num">${lesson.id}회차</span>
          <span class="unit-pill">${escapeHtml(lesson.unit)}</span>
        </div>
        <div class="card-title-block">
          <h3>${escapeHtml(lesson.title)}</h3>
          <p>${escapeHtml(lesson.subtitle)}</p>
        </div>
        <div class="card-counts" aria-label="회차 구성">
          <span><strong>${lesson.formulas.length}</strong>공식</span>
          <span><strong>${lesson.misconceptions.length}</strong>O/X</span>
          <span><strong>${lesson.questions.length}</strong>퀴즈</span>
        </div>
        <p class="textbook">${escapeHtml(lesson.textbook)}</p>
        <div class="progress-mini" aria-label="최근 점수"><span></span></div>
        <div class="card-badges">${savedBadge}<span class="badge">진단 ${totalItems}개</span></div>
        <div class="card-actions">
          <a class="button primary" href="${lessonUrl(lesson.id)}">진단 열기</a>
          <button class="button copy-link" data-id="${lesson.id}" type="button">링크 복사</button>
        </div>
      </article>`;
    }).join('') || `<p class="empty">검색 결과가 없습니다. 다른 개념어로 다시 검색해 보세요.</p>`;

    qsa('.copy-link').forEach(btn => btn.addEventListener('click', () => {
      const url = new URL(lessonUrl(btn.dataset.id), window.location.href).href;
      copyText(url).then(() => setButtonCopied(btn, '복사됨!', '링크 복사'));
    }));
  }

  search.addEventListener('input', draw);
  filter.addEventListener('change', draw);
  draw();
}

function renderProgressSummary() {
  const wrap = qs('#progressSummary');
  if (!wrap) return;
  const saved = window.LESSONS.map(l => getSavedResult(l.id)).filter(Boolean);
  const completed = saved.length;
  const totalLessons = window.LESSONS.length;
  const avg = completed ? Math.round(saved.reduce((sum, item) => sum + (item.percent || 0), 0) / completed) : 0;
  const nextLesson = window.LESSONS.find(l => !getSavedResult(l.id)) || window.LESSONS[window.LESSONS.length - 1];
  wrap.innerHTML = `
    <article class="stat-card" style="--stat:rgba(79,70,229,.16)"><small>총 회차</small><strong>${totalLessons}</strong><p>진도표 기반 회차별 구성</p></article>
    <article class="stat-card" style="--stat:rgba(16,185,129,.16)"><small>진행 현황</small><strong>${completed}/${totalLessons}</strong><p>이 기기에 저장된 최근 결과</p></article>
    <article class="stat-card" style="--stat:rgba(245,158,11,.18)"><small>평균 점수</small><strong>${avg}%</strong><p>${completed ? '완료 회차 기준' : '아직 완료 기록 없음'}</p></article>
    <article class="stat-card" style="--stat:rgba(6,182,212,.16)"><small>다음 추천</small><strong>${nextLesson.id}회차</strong><p>${escapeHtml(nextLesson.title)}</p></article>`;
}

function getLessonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('session') || '1');
  return window.LESSONS.find(l => l.id === id) || window.LESSONS[0];
}

function renderLessonPage() {
  const lesson = getLessonFromUrl();
  document.title = `${lesson.id}회차 · ${lesson.title}`;
  document.documentElement.style.setProperty('--lesson-accent', unitAccent(lesson.unit));
  renderConnectionStatus('lessonConnectionStatus');
  renderLessonHeader(lesson);
  renderGoals(lesson);
  renderFormulas(lesson);
  renderMisconceptions(lesson);
  renderQuiz(lesson);
  renderLessonNav(lesson);
}

function sectionHead(kicker, title, desc = '') {
  return `<div class="section-head"><p class="eyebrow blue">${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2>${desc ? `<p>${escapeHtml(desc)}</p>` : ''}</div>`;
}
function renderLessonHeader(lesson) {
  const totalItems = lesson.questions.length + lesson.misconceptions.length;
  qs('#lessonHeader').innerHTML = `<div class="lesson-hero-kicker">
      <span class="session-bubble">${lesson.id}</span>
      <span>${escapeHtml(lesson.unit)}</span>
    </div>
    <h1>${escapeHtml(lesson.title)}</h1>
    <p class="hero-lead lesson-subtitle">${escapeHtml(lesson.subtitle)}</p>
    <div class="lesson-topic-chips">
      <span>${escapeHtml(lesson.textbook)}</span>
      <span>공식 ${lesson.formulas.length}개</span>
      <span>진단 ${totalItems}개</span>
    </div>
    <div class="lesson-meta-grid" aria-label="회차 구성">
      <div class="lesson-meta"><strong>${lesson.goals.length}</strong><span>핵심 개념</span></div>
      <div class="lesson-meta"><strong>${lesson.formulas.length}</strong><span>공식 카드</span></div>
      <div class="lesson-meta"><strong>${lesson.misconceptions.length}</strong><span>O/X 체크</span></div>
      <div class="lesson-meta"><strong>${totalItems}</strong><span>총 진단</span></div>
    </div>
    <div class="header-actions">
      <button class="button" id="copyCurrentLink" type="button">이 회차 링크 복사</button>
      <button class="button" id="printPage" type="button">인쇄/PDF 저장</button>
    </div>`;
  qs('#copyCurrentLink').addEventListener('click', () => copyText(window.location.href).then(() => setButtonCopied(qs('#copyCurrentLink'), '복사됨!', '이 회차 링크 복사')));
  qs('#printPage').addEventListener('click', () => window.print());
}
function renderGoals(lesson) {
  qs('#goalsBox').innerHTML = `${sectionHead('Concept', '오늘 확인할 핵심 개념', '문장형 설명 대신 한 개념씩 카드로 정리했습니다.')}
    <div class="goal-grid">${lesson.goals.map((g, idx) => `<article class="goal-card"><span>${String(idx + 1).padStart(2, '0')}</span><strong>${escapeHtml(g)}</strong></article>`).join('')}</div>`;
}
function renderFormulas(lesson) {
  qs('#formulaBox').innerHTML = `${sectionHead('Formula', '공식 카드', '수업 직후 반드시 떠올릴 공식만 먼저 확인합니다.')}
    <div class="formula-grid">${lesson.formulas.map((f, idx) => `<article class="formula-card">
      <span class="card-number">${idx + 1}</span>
      <h3>${escapeHtml(f.name)}</h3>
      <div class="formula">${escapeHtml(f.body)}</div>
      <p>${escapeHtml(f.tip)}</p>
    </article>`).join('')}</div>`;
}
function renderMisconceptions(lesson) {
  qs('#misconceptionBox').innerHTML = `${sectionHead('Misconception', '오개념 O/X 체크', '맞으면 O, 틀리면 X. 채점 후 바로 해설이 표시됩니다.')}
    <div class="mis-list">${lesson.misconceptions.map((m, idx) => `<div class="mis-item" data-index="${idx}">
      <div class="item-number">OX ${String(idx + 1).padStart(2, '0')}</div>
      <p class="mis-claim">${escapeHtml(m.claim)}</p>
      <div class="ox-buttons" role="radiogroup" aria-label="오개념 ${idx + 1}">
        <label class="ox-choice"><input type="radio" name="mis-${idx}" value="true"><span>O</span><small>맞다</small></label>
        <label class="ox-choice"><input type="radio" name="mis-${idx}" value="false"><span>X</span><small>틀리다</small></label>
      </div>
      <div class="feedback hidden"></div>
    </div>`).join('')}</div>`;
}
function renderQuiz(lesson) {
  qs('#quizBox').innerHTML = `${sectionHead('Quiz', '5분 진단 문항', '문항을 읽고 가장 알맞은 답을 선택하세요.')}
    <form id="quizForm">
      ${lesson.questions.map((q, idx) => `<fieldset class="question" data-index="${idx}">
        <div class="item-number">Q ${String(idx + 1).padStart(2, '0')}</div>
        <legend>${escapeHtml(q.prompt)}</legend>
        <div class="choice-grid">
          ${q.choices.map((choice, cidx) => `<label class="choice"><input type="radio" name="q-${idx}" value="${cidx}"> <span>${escapeHtml(choice)}</span></label>`).join('')}
        </div>
        <div class="feedback hidden"></div>
      </fieldset>`).join('')}
      <div class="submit-row">
        <button class="button primary large" type="submit">채점하고 오개념 확인</button>
        <button class="button large" type="button" id="resetAnswers">답안 초기화</button>
      </div>
    </form>`;
  qs('#quizForm').addEventListener('submit', e => { e.preventDefault(); gradeLesson(lesson); });
  qs('#resetAnswers').addEventListener('click', () => {
    qsa('input[type=radio]').forEach(input => { input.checked = false; });
    qsa('.feedback').forEach(f => { f.className = 'feedback hidden'; f.textContent = ''; });
    qs('#resultBox').classList.add('hidden');
  });
}

function getStudentInfo() {
  return {
    name: (qs('#studentName')?.value || '').trim(),
    group: (qs('#studentGroup')?.value || qs('#studentClass')?.value || '').trim(),
    memo: (qs('#studentMemo')?.value || '').trim()
  };
}
function buildGooglePayload(lesson, result, report) {
  const studentInfo = getStudentInfo();
  const student = {
    name: studentInfo.name || '이름 미입력',
    group: studentInfo.group,
    memo: studentInfo.memo
  };
  const mis = lesson.misconceptions.map((m, idx) => {
    const picked = qs(`input[name="mis-${idx}"]:checked`);
    const pickedValue = picked ? picked.value === 'true' : null;
    return {
      type: 'OX',
      number: idx + 1,
      prompt: m.claim,
      pickedValue,
      pickedLabel: picked ? (pickedValue ? 'O' : 'X') : '미응답',
      correctValue: m.answer,
      correctLabel: m.answer ? 'O' : 'X',
      isCorrect: picked ? pickedValue === m.answer : false,
      tag: m.tag,
      feedback: m.feedback
    };
  });
  const quiz = lesson.questions.map((q, idx) => {
    const picked = qs(`input[name="q-${idx}"]:checked`);
    const value = picked ? Number(picked.value) : null;
    return {
      type: 'Quiz',
      number: idx + 1,
      prompt: q.prompt,
      pickedValue: value,
      pickedLabel: picked ? q.choices[value] : '미응답',
      correctValue: q.answer,
      correctLabel: q.choices[q.answer],
      isCorrect: picked ? value === q.answer : false,
      tag: q.tag,
      explain: q.explain
    };
  });
  return {
    app: 'physics-check',
    version: 'beautiful-form-1.0',
    pageUrl: window.location.href,
    submittedAt: new Date().toISOString(),
    classLabel: getClassLabel(),
    student,
    lesson: { id: lesson.id, unit: lesson.unit, title: lesson.title, subtitle: lesson.subtitle, textbook: lesson.textbook },
    result,
    answers: { misconceptions: mis, quiz },
    report,
    userAgent: navigator.userAgent
  };
}
function postToGoogleAppsScript(payload) {
  const url = getAppsScriptUrl();
  if (!url) return Promise.reject(new Error('Google Apps Script URL이 설정되지 않았습니다.'));
  return new Promise((resolve, reject) => {
    const iframeName = `submit_iframe_${Date.now()}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = iframeName;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);
    form.appendChild(input);
    document.body.appendChild(form);

    let done = false;
    const cleanup = () => setTimeout(() => { form.remove(); iframe.remove(); }, 600);
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        cleanup();
        resolve({ ok: true, assumed: true });
      }
    }, 1900);
    iframe.addEventListener('load', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve({ ok: true });
      }
    });
    try { form.submit(); } catch (err) {
      clearTimeout(timer);
      cleanup();
      reject(err);
    }
  });
}

function getTagGuide(tag) {
  const name = String(tag || '').trim();
  const rules = [
    {
      keys: ['그래프', '속력', '속도', '변위', '가속도', '등가속도', '시간기록계', '평균값'],
      area: '운동 그래프·물리량 해석',
      diagnosis: '기울기, 넓이, 부호를 상황과 연결하는 과정에서 흔들릴 수 있습니다.',
      action: 's-t는 기울기, v-t는 넓이와 기울기, a-t는 넓이를 먼저 표시한 뒤 단위를 붙여 보세요.'
    },
    {
      keys: ['F=ma', '평형', '알짜힘', '작용반작용', '수직항력', '마찰력', '장력', '관성', '관성력', '빗면', '연결체', '탄성력', '용수철'],
      area: '힘 분석·운동방정식',
      diagnosis: '한 물체에 작용하는 힘과 서로 다른 두 물체 사이의 힘을 구분하는 연습이 더 필요합니다.',
      action: '먼저 자유물체도를 그리고, 축을 정한 뒤 “받는 모든 힘 = ma” 형태로 식을 세워 보세요.'
    },
    {
      keys: ['운동량', '충격량', '충돌', '반발계수', '평균힘', '보존법칙'],
      area: '운동량·충격량',
      diagnosis: '운동량 변화량의 방향과 충돌 전후 보존 조건을 놓치고 있을 가능성이 큽니다.',
      action: '처음 운동 방향을 +로 정하고, 충돌 전 총운동량 = 충돌 후 총운동량을 한 줄로 정리하세요.'
    },
    {
      keys: ['일', '일률', '에너지', '위치에너지', '운동에너지', '탄성에너지', '보존력', '비보존력', '중력에너지'],
      area: '일·에너지 보존',
      diagnosis: '일의 부호, 에너지 전환, 비보존력이 한 일을 함께 판단하는 부분이 약할 수 있습니다.',
      action: '시작점과 끝점을 정하고 Ek, Ep, 탄성 Ep, 마찰이 한 일을 표로 나누어 적어 보세요.'
    },
    {
      keys: ['기체', '내부에너지', '제1법칙', '등적', '등온', '단열', '순환기관'],
      area: '열역학 과정',
      diagnosis: 'P-V 그래프에서 일의 부호와 내부에너지 변화량을 함께 판단하는 부분을 확인해야 합니다.',
      action: '각 과정마다 ΔV, W, ΔT, ΔU, Q의 부호를 먼저 표로 채운 뒤 계산으로 넘어가세요.'
    },
    {
      keys: ['정전기', '마찰전기', '유전분극', '검전기', '쿨롱', '전기장', '전기력선', '전위', '전하'],
      area: '정전기·전기장',
      diagnosis: '전하의 이동, 전기장 방향, 전위의 스칼라 합을 구분하는 데 혼동이 있을 수 있습니다.',
      action: '+전하가 받는 힘의 방향을 기준으로 전기장 방향을 표시하고, 전위는 부호를 포함해 스칼라로 더하세요.'
    },
    {
      keys: ['전류', '전압', '저항', '옴의 법칙', '직렬', '병렬', '전력', '송전', '계기', '도선저항'],
      area: '전기회로',
      diagnosis: '직렬/병렬에서 같은 물리량이 무엇인지와 전력 공식 선택이 약할 수 있습니다.',
      action: '직렬은 전류 같음, 병렬은 전압 같음을 먼저 표시한 뒤 I=V/R, P=IV 중 가장 편한 식을 고르세요.'
    },
    {
      keys: ['자기', '자속', '전자기', '렌츠', '패러데이', '솔레노이드', '직선도선'],
      area: '자기장·전자기유도',
      diagnosis: '오른손 법칙, 자속 변화, 렌츠 법칙의 “변화를 방해하는 방향” 판단이 흔들릴 수 있습니다.',
      action: '자기장 방향을 먼저 표시하고, 자속이 증가/감소하는지 판단한 뒤 이를 방해하는 유도전류를 정하세요.'
    },
    {
      keys: ['파동', '주기', '진동수', '파속', '횡파', '종파', '수면파', '반사', '굴절', '회절', '간섭', '정상파', '현의 진동', '고정단', '자유단'],
      area: '파동의 성질·간섭',
      diagnosis: '파장·주기·진동수의 관계와 반사/굴절/간섭 조건을 연결하는 연습이 필요합니다.',
      action: 'v=fλ를 기준으로 진동수는 매질이 바뀌어도 일정한지, 경로차가 λ/2의 몇 배인지 확인하세요.'
    },
    {
      keys: ['거울', '렌즈', '결상', '작도', '상', '배율', '분산', '겉보기', '모으는 광학기기', '볼록', '오목'],
      area: '광학·상 작도',
      diagnosis: '실상/허상, 부호규칙, 작도선 선택에서 헷갈릴 가능성이 있습니다.',
      action: '작도선 2개를 먼저 그리고, 결상방정식에는 상이 생기는 방향의 부호를 적용하세요.'
    },
    {
      keys: ['상대', '광속', '동시성', '시간 지연', '길이 수축', '로런츠', '질량-에너지', '고유시간', '가설'],
      area: '특수상대론',
      diagnosis: '고유시간/고유길이를 누가 측정하는지와 로런츠 인자의 적용 위치가 약할 수 있습니다.',
      action: '사건 두 개가 같은 장소에서 일어나는 관측자를 찾아 고유시간을 정하고, 운동 방향 길이만 수축되는지 확인하세요.'
    }
  ];
  const found = rules.find(rule => rule.keys.some(key => name.includes(key)));
  return found || {
    area: name || '개념 확인',
    diagnosis: '해당 개념의 정의와 공식 적용 조건을 다시 확인하면 좋습니다.',
    action: '문항의 조건을 한 줄로 정리하고, 어떤 공식과 개념을 써야 하는지 말로 설명해 보세요.'
  };
}

function buildWeaknessAnalysis(lesson, summary, weakItems) {
  const tagMap = new Map();
  weakItems.forEach(item => {
    const tag = item.tag || '미분류';
    if (!tagMap.has(tag)) tagMap.set(tag, { tag, count: 0, items: [] });
    const bucket = tagMap.get(tag);
    bucket.count += 1;
    bucket.items.push(item);
  });
  const tagCounts = Array.from(tagMap.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'));
  const topTags = tagCounts.slice(0, 3);
  const recommendations = [];

  let comment = '';
  if (!weakItems.length) {
    comment = `${lesson.id}회차 핵심 개념은 안정적으로 이해하고 있습니다. 다음 단계는 정답을 고르는 것에서 끝내지 말고, 각 보기마다 왜 맞고 틀린지 한 문장으로 설명해 보는 것입니다.`;
    recommendations.push('틀린 문항은 없지만, 공식 카드만 보고 단위까지 말할 수 있는지 확인하기');
    recommendations.push('오개념 O/X 문장을 X로 바꾸면 어떤 반례가 되는지 직접 설명하기');
    recommendations.push('다음 회차 시작 전 오늘 공식 2개를 빈 종이에 다시 써 보기');
  } else {
    const topText = topTags.map(t => `${t.tag} ${t.count}개`).join(', ');
    const missingText = summary.unanswered ? ` 미응답 ${summary.unanswered}개가 있어 실제 약점이 더 있을 수 있습니다.` : '';
    comment = `${lesson.id}회차에서는 ${topText} 부분을 먼저 복습하는 것이 좋습니다.${missingText} 특히 같은 태그가 반복되면 공식 암기보다 “조건을 보고 어떤 개념을 써야 하는지”를 고르는 단계가 약한 것입니다.`;
    topTags.forEach(t => {
      const guide = getTagGuide(t.tag);
      recommendations.push(`${t.tag}: ${guide.action}`);
    });
    if (summary.percent < 65) recommendations.push('해설을 읽은 뒤 바로 다시 풀지 말고, 3분 후 보기 없이 다시 풀어 보기');
    else recommendations.push('틀린 문항만 다시 풀고, 정답 근거를 한 문장으로 적어 보기');
  }

  return {
    comment,
    tagCounts,
    recommendations: recommendations.slice(0, 4),
    weakItems: weakItems.slice()
  };
}

function renderWeaknessCards(analysis) {
  if (!analysis.tagCounts.length) {
    return `<div class="weakness-grid single-card">
      <article class="weakness-card excellent">
        <div class="weakness-card-head"><span class="weak-count">✓</span><strong>뚜렷한 약점 없음</strong></div>
        <p>이번 진단에서는 오답 태그가 잡히지 않았습니다. 다음 회차에서는 풀이 속도와 설명력을 함께 확인해 보세요.</p>
      </article>
    </div>`;
  }
  return `<div class="weakness-grid">${analysis.tagCounts.slice(0, 4).map((entry, idx) => {
    const guide = getTagGuide(entry.tag);
    const itemLabels = entry.items.slice(0, 3).map(item => `${item.type} ${item.no}`).join(', ');
    return `<article class="weakness-card">
      <div class="weakness-card-head"><span class="weak-count">${idx + 1}</span><strong>${escapeHtml(entry.tag)}</strong></div>
      <p class="weak-area">${escapeHtml(guide.area)} · ${entry.count}개 확인 필요</p>
      <p>${escapeHtml(guide.diagnosis)}</p>
      <div class="weak-action"><b>복습법</b><span>${escapeHtml(guide.action)}</span></div>
      <small>관련 문항: ${escapeHtml(itemLabels)}</small>
    </article>`;
  }).join('')}</div>`;
}

function renderWeakItemReview(weakItems) {
  if (!weakItems.length) return '';
  return `<div class="weak-review-block">
    <h3>다시 볼 문항</h3>
    <div class="weak-detail-list">${weakItems.slice(0, 6).map(item => `<article class="weak-detail-card">
      <div class="weak-detail-top"><span>${escapeHtml(item.type)} ${item.no}</span><b>${escapeHtml(item.status)}</b></div>
      <p>${escapeHtml(item.prompt)}</p>
      <dl>
        <div><dt>내 답</dt><dd>${escapeHtml(item.studentAnswer)}</dd></div>
        <div><dt>정답</dt><dd>${escapeHtml(item.correctAnswer)}</dd></div>
      </dl>
      <small>${escapeHtml(item.feedback)}</small>
    </article>`).join('')}</div>
  </div>`;
}

function renderNextActions(analysis) {
  return `<div class="next-actions">
    <h3>다음 복습 액션</h3>
    <ol>${analysis.recommendations.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ol>
  </div>`;
}

function makeReportText(lesson, student, summary, analysis, now) {
  const tagText = analysis.tagCounts.length
    ? analysis.tagCounts.map(t => `${t.tag}(${t.count})`).join(', ')
    : '없음';
  const weakItemText = analysis.weakItems.length
    ? analysis.weakItems.map(item => `${item.type}${item.no}-${item.tag}-${item.status}`).join(', ')
    : '없음';
  return [
    `[물리Ⅰ ${lesson.id}회차 자기점검 리포트]`,
    `이름: ${student.name || '이름 미입력'}`,
    student.group ? `반/수업명: ${student.group}` : '반/수업명: 미입력',
    `회차: ${lesson.id}회차 ${lesson.title}`,
    `점수: ${summary.score}/${summary.total} (${summary.percent}%)`,
    `판정: ${summary.level}`,
    `미응답: ${summary.unanswered}개`,
    `복습 우선순위: ${summary.weakTags.length ? summary.weakTags.join(', ') : '없음'}`,
    `약점 코멘트: ${analysis.comment}`,
    `태그별 약점: ${tagText}`,
    `다시 볼 문항: ${weakItemText}`,
    `추천 복습: ${analysis.recommendations.join(' / ')}`,
    student.memo ? `학생 메모: ${student.memo}` : '학생 메모: 없음',
    `완료 시각: ${now}`
  ].join('\n');
}

function gradeLesson(lesson) {
  const student = getStudentInfo();
  if (isNameRequired() && !student.name) {
    const nameInput = qs('#studentName');
    if (nameInput) {
      nameInput.focus();
      nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    alert('제출 전 이름 또는 닉네임을 입력해 주세요.');
    return;
  }

  let score = 0;
  const total = lesson.questions.length + lesson.misconceptions.length;
  const weakTags = [];
  const weakItems = [];
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
      weakItems.push({
        type: 'OX', no: idx + 1, tag: m.tag, status: '미응답', prompt: m.claim,
        studentAnswer: '미응답', correctAnswer: m.answer ? 'O' : 'X', feedback: m.feedback
      });
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
      weakItems.push({
        type: 'OX', no: idx + 1, tag: m.tag, status: '오답', prompt: m.claim,
        studentAnswer: value ? 'O' : 'X', correctAnswer: m.answer ? 'O' : 'X', feedback: m.feedback
      });
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
      weakItems.push({
        type: 'Q', no: idx + 1, tag: q.tag, status: '미응답', prompt: q.prompt,
        studentAnswer: '미응답', correctAnswer: q.choices[q.answer], feedback: q.explain
      });
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
      weakItems.push({
        type: 'Q', no: idx + 1, tag: q.tag, status: '오답', prompt: q.prompt,
        studentAnswer: q.choices[value], correctAnswer: q.choices[q.answer], feedback: q.explain
      });
    }
  });

  const uniqueTags = [...new Set(weakTags)].filter(Boolean);
  const percent = Math.round((score / total) * 100);
  const level = percent >= 85 ? '안정' : percent >= 65 ? '부분 이해' : '재학습 필요';
  const now = new Date().toLocaleString('ko-KR');
  const summary = { score, total, percent, level, unanswered, weakTags: uniqueTags };
  const analysis = buildWeaknessAnalysis(lesson, summary, weakItems);
  const report = makeReportText(lesson, student, summary, analysis, now);

  try {
    localStorage.setItem(`physics-check-session-${lesson.id}`, JSON.stringify({
      score, total, percent, level, tags: uniqueTags, comment: analysis.comment, at: now
    }));
  } catch (_) {}

  const resultData = {
    score,
    total,
    percent,
    level,
    unanswered,
    weakTags: uniqueTags,
    comment: analysis.comment,
    recommendations: analysis.recommendations,
    weakTagSummary: analysis.tagCounts.map(t => ({ tag: t.tag, count: t.count })),
    weakItems: analysis.weakItems.map(item => ({ type: item.type, no: item.no, tag: item.tag, status: item.status }))
  };
  const payload = buildGooglePayload(lesson, resultData, report);
  const scoreDeg = Math.round(percent * 3.6);
  const googleReady = isGoogleSubmitReady();
  const result = qs('#resultBox');
  result.classList.remove('hidden');
  result.innerHTML = `<p class="eyebrow blue">Result</p><h2>진단 결과</h2>
    <div class="score-circle" style="--score:${scoreDeg}deg" aria-label="점수"><div class="score-circle-inner"><span>${score}</span><small>/${total}</small></div></div>
    <p class="result-level"><strong>${level}</strong> · ${percent}%</p>
    <p>${unanswered ? `미응답 ${unanswered}개가 있습니다. 다시 풀면 더 정확한 진단이 됩니다.` : '모든 문항에 응답했습니다.'}</p>

    <section class="result-comment-card" aria-label="학생 맞춤 결과 코멘트">
      <div class="comment-icon">💬</div>
      <div>
        <span>Young’s Physics Comment</span>
        <h3>지금 가장 먼저 봐야 할 부분</h3>
        <p>${escapeHtml(analysis.comment)}</p>
      </div>
    </section>

    <h3>복습 우선순위</h3>
    <div class="tag-list">${uniqueTags.length ? uniqueTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') : '<span class="tag good">현재 뚜렷한 약점 태그 없음</span>'}</div>
    ${renderWeaknessCards(analysis)}
    ${renderWeakItemReview(analysis.weakItems)}
    ${renderNextActions(analysis)}

    <textarea id="reportText" readonly>${escapeHtml(report)}</textarea>
    <div class="submit-row">
      <button class="button primary" id="submitGoogle" type="button" ${googleReady ? '' : 'disabled'}>Google Sheet로 제출</button>
      <button class="button" id="copyReport" type="button">리포트 복사</button>
      <button class="button" id="downloadReport" type="button">txt로 저장</button>
    </div>
    <p id="googleSubmitStatus" class="submit-status ${googleReady ? '' : 'warn-text'}">${googleReady ? (shouldAutoSubmit() ? '채점 결과와 약점 코멘트를 Google Sheet로 자동 제출합니다.' : '제출 버튼을 누르면 결과와 약점 코멘트가 Google Sheet로 전송됩니다.') : 'Google 저장 URL이 설정되지 않아 제출 버튼이 비활성화되어 있습니다.'}</p>`;

  qs('#copyReport').addEventListener('click', () => copyText(report).then(() => setButtonCopied(qs('#copyReport'), '복사됨!', '리포트 복사')));
  qs('#downloadReport').addEventListener('click', () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `physics-session-${lesson.id}-report.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const submitBtn = qs('#submitGoogle');
  if (submitBtn && googleReady) {
    const submitHandler = async () => {
      const status = qs('#googleSubmitStatus');
      submitBtn.disabled = true;
      submitBtn.textContent = '제출 중...';
      status.className = 'submit-status';
      status.textContent = 'Google Apps Script로 결과와 약점 코멘트를 보내는 중입니다.';
      try {
        await postToGoogleAppsScript(payload);
        status.className = 'submit-status success-text';
        status.textContent = '제출 요청 완료! Google Sheet의 “제출결과”와 “문항별응답” 시트를 확인하세요.';
        submitBtn.textContent = '제출 완료';
      } catch (err) {
        status.className = 'submit-status warn-text';
        status.textContent = `제출 실패: ${err.message || err}. config.js의 Web App URL과 Apps Script 배포 권한을 확인하세요.`;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Google Sheet로 다시 제출';
      }
    };
    submitBtn.addEventListener('click', submitHandler);
    if (shouldAutoSubmit()) setTimeout(() => submitBtn.click(), 350);
  }
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderLessonNav(lesson) {
  const prev = qs('#prevLesson');
  const next = qs('#nextLesson');
  const prevId = lesson.id - 1;
  const nextId = lesson.id + 1;
  prev.classList.remove('disabled');
  next.classList.remove('disabled');
  if (prevId >= 1) { prev.href = lessonUrl(prevId); prev.textContent = `← ${prevId}회차`; }
  else { prev.classList.add('disabled'); prev.href = 'index.html'; prev.textContent = '첫 회차'; }
  if (nextId <= window.LESSONS.length) { next.href = lessonUrl(nextId); next.textContent = `${nextId}회차 →`; }
  else { next.classList.add('disabled'); next.href = 'index.html'; next.textContent = '마지막 회차'; }
}

function renderTeacherPage() {
  renderConnectionStatus('teacherConnectionStatus');
  renderTeacherLinks();
  setupTeacherButtons();
}
function configTemplate() {
  return `window.PHYSICS_CHECK_CONFIG = {\n  SUBMIT_URL: "https://script.google.com/macros/s/배포ID/exec",\n  CLASS_NAME: "물리Ⅰ",\n  AUTO_SUBMIT: true,\n  REQUIRE_STUDENT_NAME: true\n};`;
}
function setupTeacherButtons() {
  const copyBtn = qs('#copyConfigHint');
  if (copyBtn) copyBtn.addEventListener('click', () => copyText(configTemplate()).then(() => setButtonCopied(copyBtn, '복사됨!', 'config.js 예시 복사')));

  const testBtn = qs('#sendTestSubmission');
  if (testBtn) testBtn.addEventListener('click', async () => {
    const status = qs('#teacherSubmitStatus');
    if (!isGoogleSubmitReady()) {
      status.className = 'submit-status warn-text';
      status.textContent = 'config.js에 Web App URL을 먼저 입력해 주세요.';
      return;
    }
    const payload = {
      app: 'physics-check',
      version: 'teacher-test',
      pageUrl: window.location.href,
      submittedAt: new Date().toISOString(),
      classLabel: getClassLabel(),
      student: { name: '연동테스트', group: '교사용 설정', memo: 'teacher.html 테스트 제출' },
      lesson: { id: 0, unit: '테스트', title: 'Google Sheets 연동 테스트', subtitle: '', textbook: '' },
      result: { score: 1, total: 1, percent: 100, level: '테스트 성공', unanswered: 0, weakTags: [] },
      answers: { misconceptions: [], quiz: [] },
      report: '[물리Ⅰ Check] Google Sheets 연동 테스트 제출입니다.',
      userAgent: navigator.userAgent
    };
    testBtn.disabled = true;
    testBtn.textContent = '보내는 중...';
    status.className = 'submit-status';
    status.textContent = '테스트 제출을 보내는 중입니다.';
    try {
      await postToGoogleAppsScript(payload);
      status.className = 'submit-status success-text';
      status.textContent = '테스트 제출 요청 완료! Google Sheet에 행이 추가되었는지 확인하세요.';
      testBtn.textContent = '테스트 완료';
    } catch (err) {
      status.className = 'submit-status warn-text';
      status.textContent = `테스트 실패: ${err.message || err}`;
      testBtn.disabled = false;
      testBtn.textContent = '테스트 제출 다시 보내기';
    }
  });
}
function renderTeacherLinks() {
  const wrap = qs('#teacherLinks');
  if (!wrap) return;
  const base = currentBaseUrl();
  wrap.innerHTML = window.LESSONS.map(lesson => {
    const url = new URL(lessonUrl(lesson.id), base).href;
    return `<div class="teacher-link-row" style="--card-accent:${unitAccent(lesson.unit)}">
      <span><strong>${lesson.id}회차</strong> ${escapeHtml(lesson.title)}</span>
      <code>${escapeHtml(url)}</code>
      <button class="button copy-teacher" data-url="${escapeHtml(url)}" type="button">복사</button>
    </div>`;
  }).join('');
  qsa('.copy-teacher').forEach(btn => btn.addEventListener('click', () => copyText(btn.dataset.url).then(() => setButtonCopied(btn, '복사됨!', '복사'))));
}
