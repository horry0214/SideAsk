(() => {
  const copy = {
    en:{back:"Back to setup",badge:"FIRST SELECTION",kicker:"TRY THE REAL INTERACTION",title:"Select “phi node” below.",body:"Release your mouse, choose ✦ Explain, and SideAsk will open the same floating panel you will use on any webpage.",step1:"Select the words",step2:"Click Explain",step3:"Ask a follow-up",tipTitle:"Tip",tipBody:"If the Explain button does not appear, select the two words only—not the whole paragraph."},
    "zh-CN":{back:"返回设置引导",badge:"第一次划词",kicker:"体验真实交互",title:"选中下方的 “phi node”。",body:"松开鼠标后点击 ✦ 解释，SideAsk 会打开和普通网页完全相同的悬浮窗。",step1:"选中文字",step2:"点击解释",step3:"继续追问",tipTitle:"提示",tipBody:"如果没有出现“解释”按钮，请只选中这两个单词，不要选择整段。"}
  };
  globalThis.SideAskI18n.loadLocale().then(locale => {
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-practice]").forEach(node => { node.textContent = copy[locale]?.[node.dataset.practice] || copy.en[node.dataset.practice]; });
  });
})();
