/* ────────────────────────────────────────────────────────────────
   app.js  –  คลังลิงก์ YouTube
   ──────────────────────────────────────────────────────────────── */

const API = ''; // same origin – backend on same server

/* ─── STATE ──────────────────────────────────────────────────── */
let categories = [];
let allLinks = [];
let activeCategory = 'all';
let searchQuery = '';
let deleteTargetId = null;

/* ─── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadCategories(), loadLinks()]);
    bindEvents();
});

/* ─── API HELPERS ────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) throw await res.json();
    return res.json();
}

/* ─── LOAD DATA ──────────────────────────────────────────────── */
async function loadCategories() {
    categories = await apiFetch('/api/categories');
    renderTabs();
    renderCategorySelect();
    renderCatList();
}

async function loadLinks() {
    allLinks = await apiFetch('/api/links');
    renderLinks();
}

/* ─── RENDER TABS ────────────────────────────────────────────── */
function renderTabs() {
    const tabsEl = document.getElementById('categoryTabs');
    // keep "All" tab first
    tabsEl.innerHTML = `<button class="tab ${activeCategory === 'all' ? 'active' : ''}" data-id="all">📋 ทั้งหมด</button>`;

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'tab' + (activeCategory == cat.id ? ' active' : '');
        btn.dataset.id = cat.id;
        btn.textContent = cat.name;
        tabsEl.appendChild(btn);
    });

    tabsEl.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategory = btn.dataset.id === 'all' ? 'all' : parseInt(btn.dataset.id);
            tabsEl.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateSectionTitle();
            renderLinks();
        });
    });
}

/* ─── RENDER CATEGORY SELECT ─────────────────────────────────── */
function renderCategorySelect() {
    const sel = document.getElementById('linkCategory');
    sel.innerHTML = '<option value="">— ไม่ระบุหมวดหมู่ —</option>';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        sel.appendChild(opt);
    });
}

/* ─── RENDER CAT LIST (modal) ────────────────────────────────── */
function renderCatList() {
    const listEl = document.getElementById('catList');
    if (categories.length === 0) {
        listEl.innerHTML = '<p style="color:#aaa;font-size:.9rem;text-align:center;padding:12px;">ยังไม่มีหมวดหมู่</p>';
        return;
    }
    listEl.innerHTML = categories.map(cat => `
    <div class="cat-item">
      <span>${escapeHtml(cat.name)}</span>
      <button class="cat-item-del" data-id="${cat.id}" title="ลบหมวดหมู่">🗑️</button>
    </div>
  `).join('');

    listEl.querySelectorAll('.cat-item-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(`ลบหมวดหมู่ "${btn.closest('.cat-item').querySelector('span').textContent}" ใช่ไหม?\n(คลิปในหมวดนี้จะยังอยู่ แต่จะไม่มีหมวดหมู่)`)) return;
            await apiFetch(`/api/categories/${btn.dataset.id}`, { method: 'DELETE' });
            if (activeCategory == btn.dataset.id) activeCategory = 'all';
            await loadCategories();
            renderLinks();
            toast('ลบหมวดหมู่แล้ว');
        });
    });
}

/* ─── RENDER LINKS ───────────────────────────────────────────── */
function renderLinks() {
    const grid = document.getElementById('linksGrid');
    const empty = document.getElementById('emptyState');

    let filtered = allLinks;

    if (activeCategory !== 'all') {
        filtered = filtered.filter(l => l.category_id == activeCategory);
    }

    if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.url.toLowerCase().includes(q) ||
            (l.category_name && l.category_name.toLowerCase().includes(q))
        );
    }

    document.getElementById('linkCount').textContent = `${filtered.length} คลิป`;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = filtered.map(link => {
        const videoId = extractYouTubeId(link.url);
        const thumb = videoId
            ? `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" onerror="this.parentElement.innerHTML='▶️'" />`
            : '▶️';

        const date = new Date(link.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

        return `
      <div class="link-card" data-id="${link.id}">
        <div class="link-card-top">
          <div class="yt-thumb">${thumb}</div>
          <div class="link-info">
            <div class="link-title">${escapeHtml(link.title)}</div>
            ${link.category_name ? `<span class="link-category">${escapeHtml(link.category_name)}</span>` : ''}
          </div>
        </div>
        <div class="link-card-actions">
          <a class="btn-watch" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            ▶ ดูคลิป
          </a>
          <button class="btn-delete" data-id="${link.id}" data-title="${escapeHtml(link.title)}" title="ลบ">🗑️</button>
        </div>
        <div class="link-date">บันทึกเมื่อ ${date}</div>
      </div>
    `;
    }).join('');

    // delete buttons
    grid.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.title));
    });
}

/* ─── SECTION TITLE ──────────────────────────────────────────── */
function updateSectionTitle() {
    const title = document.getElementById('sectionTitle');
    if (activeCategory === 'all') {
        title.textContent = '📺 คลิปทั้งหมด';
    } else {
        const cat = categories.find(c => c.id == activeCategory);
        title.textContent = cat ? `📂 ${cat.name}` : '📺 คลิป';
    }
}

/* ─── DELETE MODAL ───────────────────────────────────────────── */
function openDeleteModal(id, title) {
    deleteTargetId = id;
    document.getElementById('deleteTargetName').textContent = title;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').style.display = 'none';
}

/* ─── BIND EVENTS ────────────────────────────────────────────── */
function bindEvents() {
    // Add link form
    document.getElementById('addLinkForm').addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const category_id = document.getElementById('linkCategory').value || null;

        try {
            const newLink = await apiFetch('/api/links', {
                method: 'POST',
                body: JSON.stringify({ title, url, category_id }),
            });
            allLinks.unshift(newLink);
            e.target.reset();
            renderLinks();
            toast('✅ บันทึกคลิปแล้ว!');
        } catch (err) {
            toast('❌ เกิดข้อผิดพลาด: ' + (err.error || 'ลองใหม่อีกครั้ง'));
        }
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', e => {
        searchQuery = e.target.value;
        renderLinks();
    });

    // Category modal open/close
    document.getElementById('manageCatBtn').addEventListener('click', () => {
        document.getElementById('catModal').style.display = 'flex';
    });

    document.getElementById('closeCatModal').addEventListener('click', () => {
        document.getElementById('catModal').style.display = 'none';
    });

    document.getElementById('catModal').addEventListener('click', e => {
        if (e.target === document.getElementById('catModal'))
            document.getElementById('catModal').style.display = 'none';
    });

    // Add category
    document.getElementById('addCatBtn').addEventListener('click', async () => {
        const name = document.getElementById('newCatName').value.trim();
        if (!name) return;
        try {
            await apiFetch('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
            document.getElementById('newCatName').value = '';
            await loadCategories();
            toast('✅ เพิ่มหมวดหมู่แล้ว!');
        } catch {
            toast('❌ หมวดหมู่นี้มีอยู่แล้ว');
        }
    });

    document.getElementById('newCatName').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('addCatBtn').click();
    });

    // Delete confirm
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (!deleteTargetId) return;
        await apiFetch(`/api/links/${deleteTargetId}`, { method: 'DELETE' });
        allLinks = allLinks.filter(l => l.id != deleteTargetId);
        renderLinks();
        closeDeleteModal();
        toast('🗑️ ลบคลิปแล้ว');
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);

    document.getElementById('deleteModal').addEventListener('click', e => {
        if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
    });
}

/* ─── UTILS ──────────────────────────────────────────────────── */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function extractYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    } catch { }
    return null;
}

let toastTimer;
function toast(msg) {
    const el = document.getElementById('toastEl') || createToast();
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function createToast() {
    const el = document.createElement('div');
    el.id = 'toastEl';
    el.className = 'toast';
    document.body.appendChild(el);
    return el;
}
