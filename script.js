const Core = {
    state: {
        panX: window.innerWidth / 2 - 150,
        panY: window.innerHeight / 2 - 150,
        scale: 1,
        isDragging: false,
        startX: 0,
        startY: 0,
        nodes: [],
        zCounter: 100,
        totalBytesReceived: 0
    },

    init() {
        this.bindEvents();
        this.startClock();
        this.loadLayout();
        if (this.state.nodes.length === 0) {
            this.spawn('market', -360, -30);
            this.spawn('terminal', -10, -30);
            this.spawn('weather', 340, 70);
        }
        this.render();
    },

    trackTraffic(bytes) {
        this.state.totalBytesReceived += bytes;
        const kb = (this.state.totalBytesReceived / 1024).toFixed(2);
        const display = document.getElementById('load-val');
        display.innerText = `${kb} KB`;
        display.classList.remove('traffic-flash');
        void display.offsetWidth;
        display.classList.add('traffic-flash');
    },

    bindEvents() {
        const onStart = (e) => {
            if (e.target.closest('.node') || e.target.closest('#toolbar')) return;
            this.state.isDragging = true;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            this.state.startX = cx - this.state.panX;
            this.state.startY = cy - this.state.panY;
        };

        const onMove = (e) => {
            if (!this.state.isDragging) return;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            this.state.panX = cx - this.state.startX;
            this.state.panY = cy - this.state.startY;
            this.render();
        };

        window.addEventListener('mousedown', onStart);
        window.addEventListener('touchstart', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('mouseup', () => this.state.isDragging = false);
        window.addEventListener('touchend', () => this.state.isDragging = false);

        window.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.95 : 1.05;
            this.state.scale = Math.min(Math.max(0.4, this.state.scale * delta), 2);
            this.render();
        }, { passive: false });
    },

    render() {
        const world = document.getElementById('world');
        const vp = document.getElementById('viewport');
        world.style.transform = `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.scale})`;
        vp.style.backgroundPosition = `${this.state.panX}px ${this.state.panY}px`;
        vp.style.backgroundSize = `${40 * this.state.scale}px ${40 * this.state.scale}px`;
        this.updateCables();
    },

    spawn(type, x, y, data = null) {
        const id = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        const node = new Node(id, type, x !== undefined ? x : 400, y !== undefined ? y : 400, data);
        this.state.nodes.push(node);
        node.init();
    },

    updateCables() {
        const svg = document.getElementById('cables-svg');
        svg.innerHTML = '';
        for (let i = 0; i < this.state.nodes.length - 1; i++) {
            const n1 = this.state.nodes[i], n2 = this.state.nodes[i+1];
            const e1 = document.getElementById(n1.id), e2 = document.getElementById(n2.id);
            if (!e1 || !e2) continue;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
            path.setAttribute("x1", e1.offsetLeft + 160);
            path.setAttribute("y1", e1.offsetTop + 40);
            path.setAttribute("x2", e2.offsetLeft + 160);
            path.setAttribute("y2", e2.offsetTop + 40);
            path.setAttribute("class", "cable");
            svg.appendChild(path);
        }
    },

    saveLayout() {
        const data = this.state.nodes.map(n => {
            const el = document.getElementById(n.id);
            if (!el) return null;
            return { type: n.type, x: el.offsetLeft, y: el.offsetTop, data: n.data };
        }).filter(Boolean);
        localStorage.setItem('nc_config', JSON.stringify(data));
        alert("CONFIG_SAVED");
    },

    loadLayout() {
        const saved = localStorage.getItem('nc_config');
        if (saved) JSON.parse(saved).forEach(p => this.spawn(p.type, p.x, p.y, p.data));
    },

    startClock() {
        setInterval(() => document.getElementById('clock').innerText = new Date().toTimeString().split(' ')[0], 1000);
    }
};

class Node {
    constructor(id, type, x, y, data) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.data = data || {};
    }

    init() {
        const el = document.createElement('div');
        el.id = this.id;
        el.className = 'node';
        el.style.left = this.x + 'px';
        el.style.top = this.y + 'px';
        el.innerHTML = `
            <div class="node-header">
                <span>[${this.type.toUpperCase()}_v1.0]</span>
                <span style="cursor:pointer" onclick="this.closest('.node').instance.destroy()">[X]</span>
            </div>
            <div class="node-content" id="c_${this.id}">INITIATING...</div>
        `;
        document.getElementById('world').appendChild(el);
        el.instance = this;
        this.makeDraggable(el);
        this.loadContent();
    }

    destroy() {
        const el = document.getElementById(this.id);
        if (el) el.remove();
        Core.state.nodes = Core.state.nodes.filter(n => n.id !== this.id);
        Core.updateCables();
    }

    makeDraggable(el) {
        const h = el.querySelector('.node-header');
        const dragStart = (e) => {
            el.style.zIndex = Core.state.zCounter++;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            let ox = cx / Core.state.scale - el.offsetLeft;
            let oy = cy / Core.state.scale - el.offsetTop;
            const dragMove = (e) => {
                const mx = e.touches ? e.touches[0].clientX : e.clientX;
                const my = e.touches ? e.touches[0].clientY : e.clientY;
                el.style.left = (mx / Core.state.scale - ox) + 'px';
                el.style.top = (my / Core.state.scale - oy) + 'px';
                Core.updateCables();
            };
            const dragStop = () => {
                document.removeEventListener('mousemove', dragMove);
                document.removeEventListener('mouseup', dragStop);
            };
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragStop);
        };
        h.addEventListener('mousedown', dragStart);
    }

    async loadContent() {
        const c = document.getElementById(`c_${this.id}`);
        if (this.type === 'market') {
            try {
                const coins = ['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple', 'polkadot', 'dogecoin', 'chainlink', 'uniswap', 'litecoin'];
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
                const d = await res.json();
                Core.trackTraffic(JSON.stringify(d).length);
                this.data.marketData = d;
                if (this.data.defaultCoin) {
                    this.showDetails(this.data.defaultCoin);
                } else {
                    c.innerHTML = `<div style="font-size: 11px; margin-bottom: 8px;">LIVE_MARKET_DATA (TAP FOR DETAILS)</div>` + Object.entries(d).map(([k, v]) => `
                        <div class="data-row interactive" onclick="document.getElementById('${this.id}').instance.showDetails('${k}')">
                            <span class="data-label">${k.toUpperCase()}</span>
                            <span class="data-value">$${v.usd.toLocaleString()}</span>
                        </div>
                    `).join('');
                }
            } catch (err) {
                const mock = {
                    bitcoin: { usd: 67340.50, usd_24h_change: 2.34, usd_market_cap: 1324560000000 },
                    ethereum: { usd: 3450.25, usd_24h_change: -1.12, usd_market_cap: 415300000000 },
                    solana: { usd: 148.80, usd_24h_change: 5.67, usd_market_cap: 69120000000 },
                    cardano: { usd: 0.38, usd_24h_change: -0.45, usd_market_cap: 13500000000 },
                    ripple: { usd: 0.58, usd_24h_change: 0.12, usd_market_cap: 32400000000 },
                    polkadot: { usd: 6.22, usd_24h_change: 1.89, usd_market_cap: 8900000000 },
                    dogecoin: { usd: 0.12, usd_24h_change: -2.31, usd_market_cap: 17800000000 },
                    chainlink: { usd: 14.15, usd_24h_change: 3.42, usd_market_cap: 8300000000 },
                    uniswap: { usd: 7.85, usd_24h_change: 0.76, usd_market_cap: 4700000000 },
                    litecoin: { usd: 74.30, usd_24h_change: -0.98, usd_market_cap: 5500000000 }
                };
                this.data.marketData = mock;
                if (this.data.defaultCoin) {
                    this.showDetails(this.data.defaultCoin);
                } else {
                    c.innerHTML = `<div style="font-size: 11px; margin-bottom: 8px;">LIVE_MARKET_DATA (MOCK/TAP)</div>` + Object.entries(mock).map(([k, v]) => `
                        <div class="data-row interactive" onclick="document.getElementById('${this.id}').instance.showDetails('${k}')">
                            <span class="data-label">${k.toUpperCase()}</span>
                            <span class="data-value">$${v.usd.toLocaleString()}</span>
                        </div>
                    `).join('');
                }
            }
        } else if (this.type === 'signal') {
            const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://news.ycombinator.com/rss');
            const d = await res.json();
            Core.trackTraffic(JSON.stringify(d).length);
            c.innerHTML = `ENCRYPTED_SIGNAL_FEED<br><br>` + d.items.slice(0, 3).map(i => `<div style="margin-bottom:8px; border-left:1px solid var(--neon); padding-left:5px">> ${i.title}</div>`).join('');
        } else if (this.type === 'weather') {
            this.renderWeather();
        } else if (this.type === 'terminal') {
            this.renderTerminal();
        }
    }

    async showDetails(coinId) {
        const c = document.getElementById(`c_${this.id}`);
        const coinData = this.data.marketData[coinId];
        const currentPrice = coinData ? coinData.usd : 0;
        const change24h = coinData ? (coinData.usd_24h_change || 0) : 0;
        const cap = coinData ? (coinData.usd_market_cap || 0) : 0;
        
        c.innerHTML = `
            <button class="chart-back-btn" onclick="document.getElementById('${this.id}').instance.restoreMarket()">[< BACK]</button>
            <div style="font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 5px;">${coinId} DETAILS</div>
            <div class="data-row">
                <span class="data-label">PRICE</span>
                <span class="data-value">$${currentPrice.toLocaleString()}</span>
            </div>
            <div class="data-row">
                <span class="data-label">24H CHANGE</span>
                <span class="data-value ${change24h >= 0 ? 'trend-up' : 'trend-down'}">${change24h.toFixed(2)}%</span>
            </div>
            <div class="data-row">
                <span class="data-label">MARKET CAP</span>
                <span class="data-value">$${cap.toLocaleString()}</span>
            </div>
            <div class="chart-container" id="chart_${this.id}">
                <div style="font-size: 9px; opacity: 0.6; margin-bottom: 4px;">7D TRENDLINE</div>
                <div style="height: 80px; display: flex; align-items: center; justify-content: center;" id="svg_wrap_${this.id}">
                    FETCHING_HISTORY...
                </div>
            </div>
        `;

        let prices = [];
        try {
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`);
            const hist = await res.json();
            Core.trackTraffic(JSON.stringify(hist).length);
            prices = hist.prices.map(p => p[1]);
        } catch (err) {
            prices = Array.from({length: 8}, () => currentPrice * (1 + (Math.random() - 0.5) * 0.1));
        }

        if (prices.length > 0) {
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            const range = max - min || 1;
            const width = 280;
            const height = 70;
            const points = prices.map((p, idx) => {
                const x = (idx / (prices.length - 1)) * width;
                const y = height - ((p - min) / range) * height;
                return `${x},${y}`;
            });
            const polyPoints = `0,${height} ` + points.join(' ') + ` ${width},${height}`;

            const wrap = document.getElementById(`svg_wrap_${this.id}`);
            if (wrap) {
                wrap.innerHTML = `
                    <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">
                        <defs>
                            <linearGradient id="grad_${this.id}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#00ff41" stop-opacity="0.4"/>
                                <stop offset="100%" stop-color="#00ff41" stop-opacity="0"/>
                            </linearGradient>
                            <filter id="glow_${this.id}">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <polygon points="${polyPoints}" fill="url(#grad_${this.id})" />
                        <polyline points="${points.join(' ')}" fill="none" stroke="#00ff41" stroke-width="1.5" filter="url(#glow_${this.id})" />
                    </svg>
                `;
            }
        }
    }

    restoreMarket() {
        delete this.data.defaultCoin;
        this.loadContent();
    }

    renderWeather(city = "London") {
        const c = document.getElementById(`c_${this.id}`);
        c.innerHTML = `
            <input type="text" id="w_in_${this.id}" placeholder="ENTER CITY..." value="${city}">
            <button class="tool-btn" style="width:100%; margin-bottom:10px" onclick="document.getElementById('${this.id}').instance.updateWeather()">GET_WEATHER</button>
            <div id="w_out_${this.id}">FETCHING_ATMOSPHERE...</div>
        `;
        this.updateWeather(city);
    }

    async updateWeather(cityInput) {
        const city = cityInput || document.getElementById(`w_in_${this.id}`).value;
        const out = document.getElementById(`w_out_${this.id}`);
        try {
            const res = await fetch(`https://wttr.in/${city}?format=j1`);
            const d = await res.json();
            Core.trackTraffic(JSON.stringify(d).length);
            const cur = d.current_condition[0];
            out.innerHTML = `
                <div class="data-row"><span class="data-label">CITY</span><span class="data-value">${city.toUpperCase()}</span></div>
                <div class="data-row"><span class="data-label">TEMP</span><span class="data-value">${cur.temp_C}°C</span></div>
                <div class="data-row"><span class="data-label">DESC</span><span class="data-value">${cur.weatherDesc[0].value}</span></div>
                <div class="data-row"><span class="data-label">HUMID</span><span class="data-value">${cur.humidity}%</span></div>
            `;
        } catch (e) {
            out.innerHTML = "ERR: CITY_NOT_FOUND";
        }
    }

    renderTerminal() {
        const c = document.getElementById(`c_${this.id}`);
        c.innerHTML = `
            <div class="terminal-out" id="t_out_${this.id}">
                - CRPT OS [v1.0]<br>
                - READY for input...<br>
                - Type 'HELP' for commands
            </div>
            <input type="text" id="t_in_${this.id}" placeholder="ENTER COMMAND...">
        `;
        const input = document.getElementById(`t_in_${this.id}`);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                this.execCmd(input.value);
                input.value = "";
            }
        };
    }

    execCmd(raw) {
        const cmd = raw.toUpperCase().trim();
        const out = document.getElementById(`t_out_${this.id}`);
        out.innerHTML += `<div>> ${cmd}</div>`;
        const parts = cmd.split(" ");
        switch (parts[0]) {
            case 'HELP':
                out.innerHTML += `<div>- HELP: SHOW COMMANDS<br>- CLS: CLEAR SCREEN<br>- SPAWN [TYPE]: CREATE NODE<br>- TRAFFIC: SHOW DATA_RECV</div>`;
                break;
            case 'CLS':
                out.innerHTML = "SYSTEM_CLEARED<br>";
                break;
            case 'TRAFFIC':
                out.innerHTML += `<div>TOTAL_RECV: ${(Core.state.totalBytesReceived / 1024).toFixed(2)} KB</div>`;
                break;
            case 'SPAWN':
                if (parts[1]) {
                    Core.spawn(parts[1].toLowerCase());
                    out.innerHTML += `<div>SPAWNING ${parts[1]}...</div>`;
                } else {
                    out.innerHTML += `<div>ERR: SPECIFY TYPE (MARKET, SIGNAL, WEATHER)</div>`;
                }
                break;
            default:
                out.innerHTML += `<div>ERR: UNKNOWN_CMD</div>`;
        }
        out.scrollTop = out.scrollHeight;
    }
}

window.onload = () => Core.init();

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
    ) {
        e.preventDefault();
    }
});
