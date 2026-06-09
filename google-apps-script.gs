/**
 * 물리Ⅰ Check → Google Sheets/Drive 수집용 Google Apps Script
 *
 * 사용 방법
 * 1. Google Sheet를 새로 만들고, 메뉴에서 [확장 프로그램] → [Apps Script]를 엽니다.
 * 2. 이 파일 전체를 Code.gs에 붙여넣고 저장합니다.
 * 3. [배포] → [새 배포] → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: Anyone
 * 4. 배포 후 받은 Web app URL을 사이트의 config.js 안 SUBMIT_URL에 붙여넣습니다.
 */

const SPREADSHEET_ID = ''; // 보통 비워둡니다. 독립 스크립트로 쓸 때만 시트 ID를 넣으세요.
const DRIVE_FOLDER_ID = ''; // 선택 사항: 제출 리포트 txt 파일을 Drive 폴더에도 저장하려면 폴더 ID를 넣으세요.
const SUMMARY_SHEET_NAME = '제출결과';
const DETAIL_SHEET_NAME = '문항별응답';
const DASHBOARD_SHEET_NAME = '태그집계';

const SUMMARY_HEADERS = [
  '제출ID', '제출시각', 'ISO시각', '반/수업명', '학생명', '회차', '단원', '수업제목',
  '점수', '총점', '백분율', '판정', '미응답', '복습태그', '약점코멘트', '학생메모', 'Drive파일URL',
  '페이지URL', '브라우저', '리포트'
];

const DETAIL_HEADERS = [
  '제출ID', '제출시각', '반/수업명', '학생명', '회차', '단원', '수업제목',
  '문항종류', '문항번호', '태그', '학생답', '정답', '정오', '문항', '해설'
];

function doGet() {
  return jsonOutput_({ ok: true, service: 'physics-check-collector', time: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    lock.waitLock(10000);
    hasLock = true;

    const payload = normalizePayload_(parsePayload_(e));
    validatePayload_(payload);

    const ss = getSpreadsheet_();
    const summarySheet = getOrCreateSheet_(ss, SUMMARY_SHEET_NAME, SUMMARY_HEADERS);
    const detailSheet = getOrCreateSheet_(ss, DETAIL_SHEET_NAME, DETAIL_HEADERS);
    ensureDashboard_(ss);

    const driveUrl = createDriveBackup_(payload);
    appendSummary_(summarySheet, payload, driveUrl);
    appendDetails_(detailSheet, payload);

    return jsonOutput_({ ok: true, submissionId: payload.submissionId, driveUrl: driveUrl });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function parsePayload_(e) {
  let raw = '';
  if (e && e.parameter && e.parameter.payload) raw = e.parameter.payload;
  else if (e && e.postData && e.postData.contents) raw = e.postData.contents;
  else if (e && e.parameter) return e.parameter;

  if (!raw) throw new Error('payload가 비어 있습니다.');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('payload JSON 파싱 실패: ' + err.message);
  }
}

function normalizePayload_(p) {
  p = p || {};
  const student = p.student || {};
  const lesson = p.lesson || {};
  const result = p.result || {};
  const answers = p.answers || {};

  const normalized = {
    raw: p,
    submissionId: p.submissionId || 'PHY-' + Utilities.getUuid(),
    submittedAt: toKoreanTime_(p.submittedAt || new Date()),
    submittedAtISO: p.submittedAt || new Date().toISOString(),
    classLabel: p.classLabel || p.className || p.configClassName || '',
    pageUrl: p.pageUrl || '',
    userAgent: p.userAgent || '',
    student: {
      name: student.name || p.studentName || '이름 미입력',
      group: student.group || p.group || p.className || '',
      memo: student.memo || p.memo || ''
    },
    lesson: {
      id: lesson.id || p.sessionId || '',
      unit: lesson.unit || p.unit || '',
      title: lesson.title || p.lessonTitle || '',
      subtitle: lesson.subtitle || '',
      textbook: lesson.textbook || ''
    },
    result: {
      score: result.score !== undefined ? result.score : p.score,
      total: result.total !== undefined ? result.total : p.total,
      percent: result.percent !== undefined ? result.percent : p.percent,
      level: result.level || p.level || '',
      unanswered: result.unanswered !== undefined ? result.unanswered : p.unanswered,
      weakTags: Array.isArray(result.weakTags) ? result.weakTags : (Array.isArray(p.weakTags) ? p.weakTags : []),
      comment: result.comment || p.comment || p.weakComment || '',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
    },
    answers: {
      formulaChecks: Array.isArray(answers.formulaChecks) ? answers.formulaChecks : (Array.isArray(p.formulaAnswers) ? p.formulaAnswers : []),
      misconceptions: Array.isArray(answers.misconceptions) ? answers.misconceptions : (Array.isArray(p.misAnswers) ? p.misAnswers : []),
      quiz: Array.isArray(answers.quiz) ? answers.quiz : (Array.isArray(p.quizAnswers) ? p.quizAnswers : [])
    },
    report: p.report || ''
  };
  return normalized;
}

function validatePayload_(p) {
  if (!p || typeof p !== 'object') throw new Error('payload 형식이 올바르지 않습니다.');
  if (p.lesson.id === '' || p.lesson.id === undefined || p.lesson.id === null) throw new Error('회차 정보가 없습니다.');
  if (!p.student.name) p.student.name = '이름 미입력';
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('활성 스프레드시트를 찾을 수 없습니다. Google Sheet에 바인딩된 Apps Script에서 실행하거나 SPREADSHEET_ID를 입력하세요.');
  return ss;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function appendSummary_(sheet, p, driveUrl) {
  const row = [
    p.submissionId,
    p.submittedAt,
    p.submittedAtISO,
    p.student.group || p.classLabel || '',
    p.student.name || '',
    p.lesson.id || '',
    p.lesson.unit || '',
    p.lesson.title || '',
    numberOrBlank_(p.result.score),
    numberOrBlank_(p.result.total),
    numberOrBlank_(p.result.percent),
    p.result.level || '',
    numberOrBlank_(p.result.unanswered),
    Array.isArray(p.result.weakTags) ? p.result.weakTags.join(', ') : '',
    p.result.comment || '',
    p.student.memo || '',
    driveUrl || '',
    p.pageUrl || '',
    p.userAgent || '',
    p.report || ''
  ].map(safeCell_);
  sheet.appendRow(row);
}

function appendDetails_(sheet, p) {
  const rows = [];
  const common = [
    p.submissionId,
    p.submittedAt,
    p.student.group || p.classLabel || '',
    p.student.name || '',
    p.lesson.id || '',
    p.lesson.unit || '',
    p.lesson.title || ''
  ];

  (p.answers.formulaChecks || []).forEach(function(item, index) {
    rows.push(common.concat([
      'Formula', item.number || index + 1, item.tag || '', item.pickedLabel || item.selected || '',
      item.correctLabel || item.correctAnswer || '', item.isCorrect === true, item.prompt || '', item.feedback || item.explanation || ''
    ]).map(safeCell_));
  });

  (p.answers.misconceptions || []).forEach(function(item, index) {
    rows.push(common.concat([
      'OX', item.number || index + 1, item.tag || '', item.pickedLabel || item.selected || '',
      item.correctLabel || item.correctAnswer || '', item.isCorrect === true, item.prompt || '', item.feedback || item.explanation || ''
    ]).map(safeCell_));
  });

  (p.answers.quiz || []).forEach(function(item, index) {
    rows.push(common.concat([
      'Quiz', item.number || index + 1, item.tag || '', item.pickedLabel || item.selected || '',
      item.correctLabel || item.correctAnswer || '', item.isCorrect === true, item.prompt || '', item.explain || item.explanation || ''
    ]).map(safeCell_));
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);
  }
}

function ensureDashboard_(ss) {
  let sheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(DASHBOARD_SHEET_NAME);
  if (sheet.getLastRow() > 0) return;
  sheet.getRange('A1').setValue('오답 태그 집계').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A3').setFormula("=QUERY('문항별응답'!A:O, \"select J, count(J) where M = FALSE and J is not null group by J label J '태그', count(J) '오답 수'\", 1)");
  sheet.getRange('D1').setValue('회차별 평균 점수').setFontWeight('bold').setFontSize(14);
  sheet.getRange('D3').setFormula("=QUERY('제출결과'!A:S, \"select F, avg(K), count(A) where F is not null group by F label F '회차', avg(K) '평균 백분율', count(A) '제출 수'\", 1)");
  sheet.autoResizeColumns(1, 8);
}

function createDriveBackup_(p) {
  if (!DRIVE_FOLDER_ID) return '';
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const fileName = sanitizeFileName_([
    p.submittedAt,
    p.student.group || p.classLabel || 'class',
    p.student.name || 'student',
    (p.lesson.id || 'session') + '회차'
  ].join('_')) + '.txt';
  const text = (p.report || '') + '\n\n--- JSON ---\n' + JSON.stringify(p.raw || p, null, 2);
  const file = folder.createFile(fileName, text, MimeType.PLAIN_TEXT);
  return file.getUrl();
}

function toKoreanTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
function sanitizeFileName_(name) {
  return String(name).replace(/[\\/:*?"<>|#%{}$!`&'@+=]/g, '_').slice(0, 160);
}
function numberOrBlank_(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}
function safeCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}
function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
