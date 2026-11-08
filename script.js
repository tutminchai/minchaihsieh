'use strict';
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', '開啟導覽選單');
}
menu.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? '關閉導覽選單' : '開啟導覽選單');
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
  filterStatus.textContent = `${activeFilter.textContent}：顯示 ${visible.size} / ${matching.length} 項計畫`;
  const remaining = matching.length - visible.size;
  moreProjects.hidden = remaining === 0;
  moreProjects.innerHTML = `查看更多計畫（尚有 ${remaining} 項）<span aria-hidden="true">↓</span>`;
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
  const searchable = new Map(rows.map(row => [row, normalizeSearch(row.textContent)]));
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
      group.querySelector('.archive-year-count').textContent = `${visible} 場`;
    });
    status.textContent = `顯示 ${count} / ${rows.length} 場紀錄`;
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
