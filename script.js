'use strict';
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu(){ navigation.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','開啟導覽選單'); }
menu.addEventListener('click',()=>{const open=navigation.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'關閉導覽選單':'開啟導覽選單');});
navigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&navigation.classList.contains('open')){closeMenu();menu.focus();}});
window.matchMedia('(min-width: 721px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
const filters=document.querySelectorAll('[data-filter]');
const projects=document.querySelectorAll('[data-category]');
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});let count=0;projects.forEach(project=>{project.hidden=button.dataset.filter!=='all'&&project.dataset.category!==button.dataset.filter;if(!project.hidden)count++;});document.querySelector('#filter-status').textContent=`${button.textContent}：顯示 ${count} 個研究計畫`; }));
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){navigation.querySelectorAll('a').forEach(link=>{const active=link.hash===`#${entry.target.id}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}});},{rootMargin:'-15% 0px -60% 0px',threshold:0});document.querySelectorAll('main section[id]').forEach(section=>observer.observe(section));}
document.querySelector('#year').textContent=new Date().getFullYear();
