// ヒアリングの質問リスト（まとめた形）— ワークベンチの表示・回答・コピーのテキスト（D-042）
//
// まとめ方（groups）と前もって入れる答え（prefill）は buildProfile が作る（backend src/profiling/hearing-form.js）。
// 判定は今までどおり台本の質問 ID ごとに行う。ここでは、まとめた項目の回答を質問 ID に配り、
// 他の質問から決まる答え（derive・「なし」）を埋め、お客様に送るテキストを作る。
//
// ブラウザでは window.HearingForm、node では module.exports（テスト: node --test scs-workbench/）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HearingForm = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MARK = { yes: '○', no: '×', unknown: '？' };
  const OTHER = (g) => g.id + ':other';
  const NONE = (g) => g.id + ':none';

  /** 項目の回答。項目の質問 ID がすべて同じ答えならその答え、そろっていなければ undefined */
  function itemAnswer(part, answers) {
    const vals = part.ids.map(id => answers[id]);
    return vals.every(v => v && v === vals[0]) ? vals[0] : undefined;
  }

  /** 項目に回答する。同じ答えをもう一度選んだら取り消す */
  function setItem(part, answers, val) {
    const next = itemAnswer(part, answers) === val ? undefined : val;
    for (const id of part.ids) { if (next) answers[id] = next; else delete answers[id]; }
  }

  /** 「なし」に印が付いているか */
  function noneChecked(g, text) { return !!text[NONE(g)]; }

  /**
   * 他の質問から決まる答えを埋める。
   * - derive：from の質問と同じ答え（クラウドを使っていれば、他社のシステムにつないでいる）
   * - none：「なし」に印があれば sets、まとまりの項目に1つでも答えがあれば otherwise。どちらでもなければ消す
   */
  function deriveAnswers(groups, answers, text) {
    for (const g of groups || []) {
      for (const d of g.derive || []) {
        if (answers[d.from]) answers[d.id] = answers[d.from]; else delete answers[d.id];
      }
      for (const p of g.parts) {
        if (p.type !== 'none') continue;
        const answered = g.parts.some(x => x.type === 'closed' && x.ids.some(id => answers[id]));
        const src = noneChecked(g, text) ? p.sets : answered ? p.otherwise : null;
        const keys = Object.keys({ ...(p.sets || {}), ...(p.otherwise || {}) });
        for (const k of keys) { if (src && src[k]) answers[k] = src[k]; else delete answers[k]; }
      }
    }
    return answers;
  }

  /** 前もって入れる答えを、まだ答えのない質問に入れる */
  function applyPrefill(prefill, answers) {
    for (const id of Object.keys(prefill || {})) if (!answers[id]) answers[id] = 'yes';
    return answers;
  }

  /** 項目のすべての質問に前もって答えを入れたか */
  function isPrefilled(part, prefill) {
    return part.ids.every(id => prefill && prefill[id]);
  }

  /** お客様に送る質問リストのテキスト */
  function copyText(groups, answers, prefill) {
    const box = (part) => '（' + (MARK[itemAnswer(part, answers)] || '　') + '）';
    let anyMark = false;
    const blocks = (groups || []).map((g, i) => {
      const no = (i + 1) + '. ';
      const closed = g.parts.filter(p => p.type === 'closed');
      if (closed.some(p => isPrefilled(p, prefill) && itemAnswer(p, answers) === 'yes')) anyMark = true;
      if (g.copy === 'open') return no + g.heading + '\n 回答：';
      if (g.copy === 'single') {
        const p = closed[0];
        return no + g.heading + (p ? box(p) : '（　）');
      }
      const lines = [no + g.heading];
      for (const p of g.parts) {
        if (p.type === 'closed') lines.push(' ・' + p.label + box(p));
        else if (p.type === 'other') lines.push(' ・その他：');
        else if (p.type === 'none') lines.push(' ' + p.label + '：');
      }
      return lines.join('\n');
    });
    const head = [
      '（　）には、○（ある・はい）／×（ない・いいえ）／？（分からない）のどれかを書いてください。',
      '「回答：」の後ろには、文章でお書きください。',
    ];
    if (anyMark) head.push('あらかじめ○が入っている項目は、面談で伺った内容や、ご利用のサービスから記入したものです。違っていれば直してください。');
    return head.join('\n') + '\n\n' + blocks.join('\n\n');
  }

  return { itemAnswer, setItem, deriveAnswers, applyPrefill, isPrefilled, noneChecked, copyText, OTHER, NONE, MARK };
}));
