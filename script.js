'use strict';
const isEnglish = document.documentElement.lang === 'en';
const localize = (zh, en) => isEnglish ? en : zh;
// Native links work without JavaScript; preserve the current section on a switch.
document.querySelectorAll('[data-language]').forEach(link => {
  const base = link.getAttribute('href');
  const syncLanguageLink = () => { link.setAttribute('href', base + window.location.hash); };
  syncLanguageLink();
  window.addEventListener('hashchange', syncLanguageLink);
});
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', localize('開啟導覽選單', 'Open navigation menu'));
}
menu.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? localize('關閉導覽選單', 'Close navigation menu') : localize('開啟導覽選單', 'Open navigation menu'));
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu(); menu.focus();
  }
});
window.matchMedia('(min-width: 881px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const bioTabs = [...document.querySelectorAll('[data-bio]')];
function selectBio(tab, moveFocus = false) {
  bioTabs.forEach(item => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
  if (moveFocus) tab.focus();
}
bioTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectBio(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % bioTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + bioTabs.length) % bioTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = bioTabs.length - 1;
    else return;
    event.preventDefault();
    selectBio(bioTabs[next], true);
  });
});

const filters = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('.project-card')];
const moreProjects = document.querySelector('#show-more-projects');
const filterStatus = document.querySelector('#filter-status');
const pageSize = 6;
let activeFilter = filters[0];
let visibleLimit = pageSize;
function renderProjects() {
  const matching = projects.filter(project => activeFilter.dataset.filter === 'all' || project.dataset.category === activeFilter.dataset.filter);
  const visible = new Set(matching.slice(0, visibleLimit));
  projects.forEach(project => { project.hidden = !visible.has(project); });
  filters.forEach(item => {
    const active = item === activeFilter;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  filterStatus.textContent = localize(`${activeFilter.textContent}：顯示 ${visible.size} / ${matching.length} 項計畫`, `${activeFilter.textContent}: showing ${visible.size} / ${matching.length} projects`);
  const remaining = matching.length - visible.size;
  moreProjects.hidden = remaining === 0;
  moreProjects.innerHTML = localize(`查看更多計畫（尚有 ${remaining} 項）`, `More projects (${remaining} remaining)`) + '<span aria-hidden="true">↓</span>';
}
filters.forEach(button => button.addEventListener('click', () => {
  activeFilter = button;
  visibleLimit = pageSize;
  renderProjects();
}));
moreProjects.addEventListener('click', () => {
  const nextProject = projects.filter(project => activeFilter.dataset.filter === 'all' || project.dataset.category === activeFilter.dataset.filter)[visibleLimit];
  visibleLimit += pageSize;
  renderProjects();
  // Keep keyboard focus at the newly revealed content, even when the last button disappears.
  if (nextProject) {
    const heading = nextProject.querySelector('h3');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
});
renderProjects();

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navigation.querySelectorAll('a').forEach(link => {
        const active = link.hash === `#${entry.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
}
document.querySelector('#year').textContent = new Date().getFullYear();

// The full archive stays on this page, so closing it returns to the selected talks.
const talkArchive = document.querySelector('#talk-archive');
const archiveOpeners = [...document.querySelectorAll('[data-open-talk-archive]')];
if (talkArchive && typeof talkArchive.showModal === 'function') {
  const search = talkArchive.querySelector('#talk-search');
  const yearFilter = talkArchive.querySelector('#talk-year');
  const reset = talkArchive.querySelector('#talk-reset');
  const status = talkArchive.querySelector('#talk-results-status');
  const empty = talkArchive.querySelector('#talk-empty');
  const scrollArea = talkArchive.querySelector('.archive-results');
  const rows = [...talkArchive.querySelectorAll('.archive-record')];
  const groups = [...talkArchive.querySelectorAll('.archive-year-group')];
  const normalizeSearch = value => value.normalize('NFKC').toLocaleLowerCase('zh-TW').replace(/臺/g, '台');
  const searchable = new Map(rows.map(row => [row, normalizeSearch(row.textContent + ' ' + (row.dataset.searchOriginal || ''))]));
  let opener;
  let backdropPointer = false;

  function filterTalks() {
    const terms = normalizeSearch(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      const matchesYear = !yearFilter.value || row.dataset.year === yearFilter.value;
      const matchesQuery = terms.every(term => searchable.get(row).includes(term));
      row.hidden = !(matchesYear && matchesQuery);
      if (!row.hidden) count++;
    });
    groups.forEach(group => {
      const visible = [...group.querySelectorAll('.archive-record')].filter(row => !row.hidden).length;
      group.hidden = visible === 0;
      group.querySelector('.archive-year-count').textContent = localize(`${visible} 場`, `${visible} ${visible === 1 ? 'talk' : 'talks'}`);
    });
    status.textContent = localize(`顯示 ${count} / ${rows.length} 場紀錄`, `Showing ${count} / ${rows.length} records`);
    empty.hidden = count > 0;
    reset.disabled = !search.value && !yearFilter.value;
    scrollArea.scrollTop = 0;
  }

  archiveOpeners.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      if (talkArchive.open) return;
      opener = button;
      document.documentElement.classList.add('archive-is-open');
      talkArchive.showModal();
    });
  });
  talkArchive.querySelector('[data-close-talk-archive]').addEventListener('click', () => talkArchive.close());
  talkArchive.addEventListener('close', () => {
    document.documentElement.classList.remove('archive-is-open');
    opener?.focus({ preventScroll: true });
  });
  talkArchive.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...talkArchive.querySelectorAll('button:not(:disabled), input, select, a[href], [tabindex="0"]')].filter(control => control.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  // Only a press and release outside the panel closes the backdrop.
  const outsidePanel = event => {
    const box = talkArchive.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  talkArchive.addEventListener('pointerdown', event => {
    backdropPointer = event.target === talkArchive && outsidePanel(event);
  });
  talkArchive.addEventListener('click', event => {
    if (backdropPointer && event.target === talkArchive && outsidePanel(event)) talkArchive.close();
    backdropPointer = false;
  });
  search.addEventListener('input', filterTalks);
  yearFilter.addEventListener('change', filterTalks);
  reset.addEventListener('click', () => {
    search.value = '';
    yearFilter.value = '';
    filterTalks();
    search.focus();
  });
  filterTalks();
}

// All records remain readable without JavaScript; tabs progressively group them.
const portfolioTabs = [...document.querySelectorAll('[data-portfolio]')];
if (portfolioTabs.length) {
  document.querySelector('.portfolio-tabs').hidden = false;
  const selectPortfolio = (tab, moveFocus = false) => {
    portfolioTabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    });
    if (moveFocus) tab.focus();
  };
  portfolioTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPortfolio(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % portfolioTabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + portfolioTabs.length) % portfolioTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = portfolioTabs.length - 1;
      else return;
      event.preventDefault();
      selectPortfolio(portfolioTabs[next], true);
    });
  });
  selectPortfolio(portfolioTabs[0]);
}
document.querySelectorAll('[data-more-list]').forEach(button => {
  const cards = [...document.getElementById(button.dataset.moreList).children];
  let limit = 6;
  const render = () => {
    cards.forEach((card, index) => { card.hidden = index >= limit; });
    const remaining = Math.max(0, cards.length - limit);
    button.hidden = remaining === 0;
    button.textContent = localize(`查看更多（尚有 ${remaining} 件） ↓`, `Show more (${remaining} remaining) ↓`);
  };
  button.addEventListener('click', () => {
    const next = cards[limit];
    limit += 6;
    render();
    const heading = next?.querySelector('h4');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'nearest' }); }
  });
  render();
});

const helper = document.querySelector('.invite-helper');
if (helper) {
  const launcher = helper.querySelector('.invite-launcher');
  const panel = helper.querySelector('#invite-panel');
  const close = helper.querySelector('.invite-close');
  const answer = helper.querySelector('.invite-answer');
  const questions = [...helper.querySelectorAll('[data-invite-question]')];
  const answers = isEnglish ? {
    topics: 'Topics include:\n• AI in teaching and digital learning materials\n• Generative AI for game and web projects\n• AR/VR and science education\n• Educational metaverse and interaction design\n\nContent can be discussed to suit your school’s needs.',
    format: 'Sessions can be adapted for teachers and students at different educational levels.\n\nPossible formats include a 60–90 minute talk, a 2–3 hour practical session, or a half-day / full-day workshop. Please get in touch to confirm duration and equipment needs.',
    request: 'Please include:\n• School / organization and contact person\n• Topic and intended audience\n• Estimated attendance, date and duration\n• Venue and available equipment\n\nThe email button below opens a draft with these fields.'
  } : {
    topics: '可洽談的方向包括：\n・AI 教學應用與數位教材\n・生成式 AI 遊戲與網頁實作\n・AR／VR 與科學教育\n・教育元宇宙與互動設計\n\n可依學校需求討論合適的內容。',
    format: '適合各級學校教師與學生，可依對象調整難度。\n\n形式可討論 60–90 分鐘專題演講、2–3 小時實作研習，或半日／全日工作坊。實際時長與設備需求請聯繫確認。',
    request: '聯繫時，請提供：\n・學校／單位與聯絡窗口\n・希望主題與參與對象\n・預估人數、日期與時長\n・活動地點與設備條件\n\n點下方 Email 按鈕，即可開啟附有邀約欄位的信件。'
  };
  const closeHelper = (returnFocus = false) => {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (returnFocus) launcher.focus({ preventScroll: true });
  };
  helper.hidden = false;
  launcher.addEventListener('click', () => {
    if (!panel.hidden) { closeHelper(true); return; }
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    close.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => closeHelper(true));
  questions.forEach(button => button.addEventListener('click', () => {
    questions.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    answer.textContent = answers[button.dataset.inviteQuestion];
    answer.hidden = false;
    answer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) {
      closeHelper(true);
    }
  });
  document.addEventListener('click', event => {
    if (!panel.hidden && !helper.contains(event.target)) closeHelper();
  });
  helper.querySelector('.invite-records').addEventListener('click', () => {
    closeHelper();
    const heading = document.querySelector('#selected-talks h3, #selected-talks h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  });
}

