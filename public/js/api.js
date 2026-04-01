// nextWEEK Frontend API Client v3

const NW = {
  SECTIONS: ['Opinion','Politics','Food & Society','Culture','Health','Economy','History','Diaspora','Tech'],
  EMOJIS:   { 'Opinion':'✍️','Politics':'🏛','Food & Society':'🫕','Culture':'🎭','Health':'⚕️','Economy':'📊','History':'📜','Diaspora':'🌏','Tech':'💡' },

  logoSVG(size) {
    size = size || 48;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><circle cx="60" cy="60" r="58" fill="#1a0a2e"/><polygon points="45,10 98,60 45,110" fill="#a855c8"/><text x="28" y="60" font-family="Playfair Display,Georgia,serif" font-weight="900" font-size="26" fill="#a855c8" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 28 60)">next</text><text x="63" y="65" font-family="Playfair Display,Georgia,serif" font-weight="700" font-size="14" fill="#1a0a2e" text-anchor="middle" dominant-baseline="central" transform="rotate(-5 63 65)">WEEK</text></svg>';
  },

  getTheme()    { return localStorage.getItem('nw_theme') || 'light'; },
  setTheme(t)   { localStorage.setItem('nw_theme',t); document.documentElement.setAttribute('data-theme',t); const btn=document.getElementById('themeToggleBtn'); if(btn) btn.textContent=t==='dark'?'☀️':'🌙'; },
  initTheme()   { this.setTheme(this.getTheme()); },
  toggleTheme() { this.setTheme(this.getTheme()==='dark'?'light':'dark'); },

  _allPublishers: [],

  openPublisherSearch: async function() {
    if (!document.getElementById('pubModal')) {
      const m = document.createElement('div');
      m.id = 'pubModal';
      m.style.display = 'none';
      m.innerHTML = '<div id="pubBackdrop" style="position:fixed;inset:0;background:rgba(10,6,18,0.82);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:56px 20px 20px;backdrop-filter:blur(4px);" onclick="NW.closePubModal(event)"><div style="background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--pink);width:100%;max-width:540px;max-height:78vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(168,85,200,0.22);animation:pubIn .3s ease;" onclick="event.stopPropagation()"><div style="padding:18px 20px 14px;border-bottom:1px solid var(--rule);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;"><div><div style="font-family:Playfair Display,serif;font-size:20px;font-weight:900;color:var(--ink);">Publishers</div><div style="font-family:Space Mono,monospace;font-size:10px;color:var(--muted);margin-top:2px;letter-spacing:.04em;">Sorted by article count</div></div><button onclick="NW.closePubModal()" style="width:30px;height:30px;background:var(--bg2);border:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--muted);">&#x2715;</button></div><div style="padding:12px 20px;border-bottom:1px solid var(--rule);flex-shrink:0;"><div style="position:relative;"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none;">🔍</span><input id="pubSearchInput" type="text" placeholder="Search publishers by name…" style="width:100%;padding:9px 12px 9px 34px;background:var(--bg2);border:1px solid var(--border);color:var(--ink);font-family:Space Mono,monospace;font-size:12px;outline:none;transition:border-color .2s;" oninput="NW.filterPub(this.value)" onfocus="this.style.borderColor=\'var(--pink)\'" onblur="this.style.borderColor=\'var(--border)\'"></div></div><div id="pubList" style="overflow-y:auto;flex:1;"></div></div></div><style>@keyframes pubIn{from{transform:translateY(-14px);opacity:0}to{transform:none;opacity:1}}.pub-row{display:flex;align-items:center;gap:14px;padding:13px 20px;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--rule);text-decoration:none;color:inherit;}.pub-row:last-child{border-bottom:none;}.pub-row:hover{background:var(--pink-soft);}.pub-av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Playfair Display,serif;font-weight:900;font-size:17px;color:#fff;flex-shrink:0;}</style>';
      document.body.appendChild(m);
    }
    document.getElementById('pubModal').style.display = 'block';
    document.getElementById('pubSearchInput').value = '';
    document.getElementById('pubSearchInput').focus();
    await this.loadPub();
  },

  closePubModal: function(e) {
    if (e && e.target !== document.getElementById('pubBackdrop')) return;
    const m = document.getElementById('pubModal');
    if (m) m.style.display = 'none';
  },

  loadPub: async function() {
    document.getElementById('pubList').innerHTML = '<div style="text-align:center;padding:40px;font-family:Space Mono,monospace;font-size:12px;color:var(--muted);">Loading…</div>';
    try {
      const arts = await this.fetchArticles();
      const map = {};
      arts.forEach(function(a) {
        if (!map[a.author]) map[a.author] = { name: a.author, count: 0, sections: {}, latest: a.dateISO };
        map[a.author].count++;
        map[a.author].sections[a.section] = 1;
        if (a.dateISO > map[a.author].latest) map[a.author].latest = a.dateISO;
      });
      NW._allPublishers = Object.values(map).map(function(p) {
        p.sectionList = Object.keys(p.sections); return p;
      }).sort(function(a,b){ return b.count - a.count; });
      NW.renderPub(NW._allPublishers);
    } catch(_e) {
      document.getElementById('pubList').innerHTML = '<div style="text-align:center;padding:40px;font-family:Space Mono,monospace;font-size:12px;color:var(--muted);">Could not load publishers.</div>';
    }
  },

  renderPub: function(list) {
    const el = document.getElementById('pubList');
    if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:40px;font-family:Space Mono,monospace;font-size:12px;color:var(--muted);">No publishers found.</div>'; return; }
    const colors = ['#a855c8','#7c3aed','#6d28d9','#8b3faa','#9333ea'];
    el.innerHTML = list.map(function(p, i) {
      const initials = p.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      const rank = i+1;
      const rankLabel = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank;
      const color = colors[i % colors.length];
      return '<a class="pub-row" href="/publishers.html?name='+encodeURIComponent(p.name)+'" onclick="document.getElementById(\'pubModal\').style.display=\'none\'">'
        + '<div style="width:28px;text-align:center;font-family:Space Mono,monospace;font-size:'+(rank<=3?'16':'11')+'px;color:'+(rank<=3?'var(--pink)':'var(--muted)')+';flex-shrink:0;">'+rankLabel+'</div>'
        + '<div class="pub-av" style="background:'+color+';">'+initials+'</div>'
        + '<div style="flex:1;min-width:0;">'
          + '<div style="font-family:Playfair Display,serif;font-weight:700;font-size:15px;color:var(--ink);">'+p.name+'</div>'
          + '<div style="font-family:Space Mono,monospace;font-size:10px;color:var(--muted);margin-top:3px;">'+p.sectionList.slice(0,3).join(' · ')+(p.sectionList.length>3?' · …':'') + ' &nbsp;·&nbsp; Last: '+NW.formatDate(p.latest)+'</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;">'
          + '<div style="font-family:Playfair Display,serif;font-size:26px;font-weight:900;color:var(--pink);line-height:1;">'+p.count+'</div>'
          + '<div style="font-family:Space Mono,monospace;font-size:9px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;">article'+(p.count!==1?'s':'')+'</div>'
        + '</div>'
        + '</a>';
    }).join('');
  },

  filterPub: function(q) {
    const filtered = q.trim() ? NW._allPublishers.filter(function(p){ return p.name.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : NW._allPublishers;
    NW.renderPub(filtered);
  },

  getToken()  { return sessionStorage.getItem('nw_token'); },
  getRole()   { return sessionStorage.getItem('nw_role'); },
  getName()   { return sessionStorage.getItem('nw_name'); },
  setSession: function(token, role, name) { sessionStorage.setItem('nw_token',token); sessionStorage.setItem('nw_role',role); sessionStorage.setItem('nw_name',name); },
  clearSession: function() { ['nw_token','nw_role','nw_name'].forEach(function(k){sessionStorage.removeItem(k);}); },
  isLoggedIn()  { return !!this.getToken(); },
  isAdmin()     { return this.getRole() === 'admin'; },
  isPublisher() { return this.getRole() === 'publisher' || this.getRole() === 'admin'; },

  api: async function(method, path, body, isForm) {
    const opts = { method: method, headers: {} };
    const token = this.getToken();
    if (token) opts.headers['x-auth-token'] = token;
    if (body) {
      if (isForm) opts.body = body;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(path, opts);
    if (!res.ok) { const err = await res.json().catch(function(){return {error:res.statusText};}); throw new Error(err.error || 'HTTP '+res.status); }
    return res.json();
  },

  login: async function(u,p) { const d = await this.api('POST','/api/login',{username:u,password:p}); if(d.ok) this.setSession(d.token,d.role,d.name); return d; },
  register: function(fd) { return this.api('POST','/api/register',fd,true); },
  fetchArticles: function(s) { return this.api('GET','/api/articles'+(s?'?section='+encodeURIComponent(s):'')); },
  fetchArticle: function(id) { return this.api('GET','/api/articles/'+id); },
  fetchSections: function() { return this.api('GET','/api/sections'); },
  publishArticle: function(fd) { return this.api('POST','/api/articles',fd,true); },
  deleteArticle: function(id) { return this.api('DELETE','/api/articles/'+id); },
  fetchStats: function() { return this.api('GET','/api/stats'); },
  fetchUsers: function() { return this.api('GET','/api/users'); },
  fetchPending: function() { return this.api('GET','/api/users/pending'); },
  approveUser: function(id) { return this.api('POST','/api/users/'+id+'/approve'); },
  rejectUser: function(id) { return this.api('POST','/api/users/'+id+'/reject'); },
  deleteUser: function(id) { return this.api('DELETE','/api/users/'+id); },
  createUser: function(d) { return this.api('POST','/api/users',d); },
  fetchTxtFiles: function() { return this.api('GET','/api/txt-files'); },
  fetchTxtContent: async function(f) { const res = await fetch('/api/txt-files/'+encodeURIComponent(f),{headers:{'x-auth-token':this.getToken()}}); return res.text(); },

  readTime: function(body) { body=body||''; return Math.max(1,Math.round(body.split(/\s+/).length/200))+' min read'; },
  excerpt: function(t,n) { n=n||180; return t.length>n ? t.slice(0,n).trimEnd()+'…' : t; },
  formatDate: function(iso) { if(!iso) return ''; return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}); },
  articleURL: function(id) { return '/article.html?id='+id; },
  sectionURL: function(s)  { return '/section.html?s='+encodeURIComponent(s); },
  publisherURL: function(name) { return '/publishers.html?name='+encodeURIComponent(name); },
  logout: function() { this.clearSession(); location.href='/'; },

  subscribe: function() {
    const v = (document.getElementById('nlEmail')||{}).value||'';
    if(!v.includes('@')){ alert('Please enter a valid email.'); return; }
    alert('✓ Subscribed!'); document.getElementById('nlEmail').value='';
  },

  renderMasthead: function(activeSection) {
    activeSection = activeSection || '';
    const today = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const navLinks = this.SECTIONS.map((s) => '<a href="'+this.sectionURL(s)+'" '+(activeSection===s?'class="active-section"':'')+'>'+( this.EMOJIS[s]||'')+' '+s+'</a>').join('');
    let rightHTML = '';
    if (this.isLoggedIn()) {
      const role = this.getRole(), name = this.getName();
      rightHTML = '<span class="user-chip">'+name+' <span class="role-badge '+role+'">'+role+'</span> <a href="#" onclick="NW.logout();return false;" style="color:var(--muted);font-size:9px;">logout</a></span>'
        + (this.isPublisher() ? '<a href="/admin.html" class="admin-link">⚙ CMS</a>' : '');
    } else {
      rightHTML = '<a href="/login.html" class="login-link">Sign In</a>';
    }
    return '<div class="ticker-wrap"><div class="ticker-track" id="tickerTrack"></div></div>'
      + '<header class="masthead"><div class="masthead-top"><div class="masthead-meta">'+today+' &nbsp;|&nbsp; Hyderabad Edition</div>'
      + '<div class="masthead-actions"><nav class="masthead-nav"><a href="/">Home</a><a href="/section.html?s=Opinion">Opinion</a><a href="/section.html?s=Politics">Politics</a><a href="/section.html?s=Culture">Culture</a></nav>'
      + '<button class="theme-toggle" id="themeToggleBtn" onclick="NW.toggleTheme()" title="Toggle theme">🌙</button>'
      + '<button class="publisher-search-btn" onclick="NW.openPublisherSearch()" title="Browse publishers">✍️ Publishers</button>'
      + rightHTML + '</div></div>'
      + '<div class="nameplate"><a class="nameplate-brand" href="/">'+this.logoSVG(70)+'<div class="nameplate-text"><h1><span class="next">next</span><span class="week">WEEK</span></h1><div class="nameplate-sub">Opinions that bite back</div></a><div class="nameplate-rule">Est. 2022 &nbsp;✦&nbsp; Independent &nbsp;✦&nbsp; Unsponsored &nbsp;✦&nbsp; Unapologetic</div></div>'
      + '<nav class="nav-strip">'+navLinks+'</nav></header>';
  },

  renderFooter: function() {
    const sectionLinks = this.SECTIONS.map((s) => '<li><a href="'+this.sectionURL(s)+'">'+s+'</a></li>').join('');
    return '<footer><div class="footer-grid"><div class="footer-brand"><a href="/" style="text-decoration:none;display:inline-flex;align-items:center;gap:14px;">'+this.logoSVG(52)+'<div style="font-family:Playfair Display,serif;font-size:26px;font-weight:900;letter-spacing:-0.02em;"><span style="color:var(--pink)">next</span>WEEK</div></a><p>An independent opinion publication from Hyderabad.</p><div class="footer-social"><a href="#">X</a><a href="#">IN</a><a href="#">YT</a><a href="#">WA</a></div></div><div class="footer-col"><h4>Sections</h4><ul>'+sectionLinks+'</ul></div><div class="footer-col"><h4>Publication</h4><ul><li><a href="#">About Us</a></li><li><a href="/login.html">Sign In</a></li><li><a href="/register.html">Become a Publisher</a></li><li><a href="#">Contact</a></li></ul></div><div class="footer-col"><h4>Subscribe</h4><ul><li><a href="#">Newsletter</a></li><li><a href="#">Print Edition</a></li><li><a href="#">Podcast</a></li><li><a href="#">RSS Feed</a></li></ul></div></div><div class="footer-bottom"><span>© '+new Date().getFullYear()+' nextWEEK. All opinions reserved. Hyderabad, India.</span><span><a href="#">Privacy</a> &nbsp;·&nbsp; <a href="#">Terms</a> &nbsp;·&nbsp; write@nextweek.in</span></div></footer>';
  },

  renderNewsletter: function() {
    return '<div class="newsletter-bar"><h3>Don\'t Miss a Word.</h3><p>One sharp opinion, every week. No ads, no noise.</p><div class="newsletter-form"><input type="email" id="nlEmail" placeholder="your@email.com"><button onclick="NW.subscribe()">Subscribe →</button></div></div>';
  },

  initTicker: async function() {
    const track = document.getElementById('tickerTrack');
    if (!track) return;
    try {
      const arts = await this.fetchArticles();
      const items = arts.length ? arts.slice(0,8).map(function(a){return a.title;}) : ['Welcome to nextWEEK — Independent opinion from Hyderabad'];
      const html = items.map(function(t){return '<span>'+t+'</span>';}).join('');
      track.innerHTML = html + html;
    } catch(_e) { track.innerHTML = '<span>nextWEEK — Opinions that bite back</span><span>nextWEEK — Opinions that bite back</span>'; }
  },

  initReveal: function() {
    const obs = new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible');});},{threshold:0.08});
    document.querySelectorAll('.reveal').forEach(function(el){obs.observe(el);});
  },

  renderCard: function(art, size) {
    size = size || 'normal';
    const emoji = this.EMOJIS[art.section] || '📰';
    const thumb = art.imageUrl
      ? '<div style="background:url(\''+art.imageUrl+'\') center/cover;width:100%;height:300px;border:1px solid var(--border);margin-bottom:18px;"></div>'
      : '<div style="width:100%;height:300px;border:1px solid var(--border);margin-bottom:18px;background:linear-gradient(135deg,#3d1a5e,#a855c8);display:flex;align-items:center;justify-content:center;font-size:72px;">'+emoji+'</div>';
    const sthumb = art.imageUrl
      ? '<div style="width:64px;height:64px;flex-shrink:0;overflow:hidden;border:1px solid var(--border);"><img src="'+art.imageUrl+'" style="width:100%;height:100%;object-fit:cover;" alt=""></div>'
      : '<div style="width:64px;height:64px;flex-shrink:0;background:var(--bg2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;">'+emoji+'</div>';

    if (size==='hero') return '<article onclick="location.href=\''+this.articleURL(art.id)+'\'" style="cursor:pointer;transition:opacity .2s;" onmouseover="this.style.opacity=\'.88\'" onmouseout="this.style.opacity=\'1\'">'+thumb+'<div class="card-cat">'+art.section+'</div><h2 style="font-family:Playfair Display,serif;font-size:clamp(24px,3.5vw,42px);font-weight:900;line-height:1.1;letter-spacing:-.02em;margin:8px 0 10px;">'+art.title+'</h2><div class="card-byline">'+art.author+' &nbsp;·&nbsp; '+this.readTime(art.excerpt||art.body||'')+'</div><p class="card-excerpt">'+this.excerpt(art.excerpt||art.body||'',220)+'</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;"><div class="tags">'+( (art.tags||[]).slice(0,3).map(function(t){return '<span class="tag">'+t+'</span>';}).join(''))+'</div><a href="'+this.articleURL(art.id)+'" class="read-link">Read →</a></div></article>';

    return '<article onclick="location.href=\''+this.articleURL(art.id)+'\'" style="display:flex;gap:12px;padding:14px 0;border-bottom:1px dashed var(--rule);cursor:pointer;transition:opacity .2s;" onmouseover="this.style.opacity=\'.78\'" onmouseout="this.style.opacity=\'1\'">'+sthumb+'<div><div class="card-cat">'+art.section+'</div><div style="font-family:Playfair Display,serif;font-weight:700;font-size:13px;line-height:1.3;margin:3px 0 4px;">'+art.title+'</div><div style="font-size:11px;color:var(--muted);line-height:1.5;">'+this.excerpt(art.excerpt||art.body||'',110)+'</div><div class="card-meta"><span class="card-author">'+art.author+'</span> &nbsp;·&nbsp; '+this.formatDate(art.dateISO)+'</div></div></article>';
  }
};
