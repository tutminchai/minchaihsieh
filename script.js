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
