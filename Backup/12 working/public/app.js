const API_URL = '/api'; // Use relative URL

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Modal Elements
const openAddChannelModalBtn = document.getElementById('openAddChannelModalBtn');
const closeAddChannelModalBtn = document.getElementById('closeAddChannelModalBtn');
const addChannelModal = document.getElementById('addChannelModal');
const addChannelBtn = document.getElementById('addChannelBtn');
const refreshDataBtn = document.getElementById('refreshDataBtn');
const pinModal = null; // Removed
const channelInput = document.getElementById('channelInput');

const channelsGrid = document.getElementById('channelsGrid');
const channelsTableContainer = document.getElementById('channelsTableContainer');
const channelsTableBody = document.getElementById('channelsTableBody');
const toastEl = document.getElementById('toast');
const totalCountEl = document.getElementById('totalCount');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnToggleMenu = document.getElementById('columnToggleMenu');

// Navigation Elements
const navDashboard = document.getElementById('navDashboard');
const navDatabase = document.getElementById('navDatabase');
const navAnalytics = document.getElementById('navAnalytics');
const viewDashboard = document.getElementById('viewDashboard');
const viewDatabase = document.getElementById('viewDatabase');
const viewAnalytics = document.getElementById('viewAnalytics');
const overviewTableBody = document.getElementById('overviewTableBody');

// Analytics Elements (Still using localStorage as per original design)
const analyticsTableBody = document.getElementById('analyticsTableBody');
const analyticsCountEl = document.getElementById('analyticsCount');
const forceRecordBtn = document.getElementById('forceRecordBtn');
const clearAnalyticsBtn = document.getElementById('clearAnalyticsBtn');

// --- State ---
let channels = []; // This will be populated from the database
let analyticsHistory = JSON.parse(localStorage.getItem('analytics_history')) || [];
let lastAnalyticsUpdate = parseInt(localStorage.getItem('last_analytics_update') || '0');
let viewMode = localStorage.getItem('viewMode') || 'table';
let sortBy = localStorage.getItem('sortBy') || 'name-asc';
let searchQuery = '';

// --- Column Configuration (Kept in localStorage for user preference) ---
const defaultColumnOrder = [
    'col-no', 'col-channel', 'col-subs', 'col-username',
    'col-ownership', 'col-status', 'col-added', 'col-desc', 'col-action'
];
let columnOrder = JSON.parse(localStorage.getItem('columnOrder')) || defaultColumnOrder;
const columnLabels = {
    'col-no': 'No.', 'col-channel': 'Channel', 'col-status': 'Status', 'col-subs': 'Subscribers',
    'col-username': 'Username', 'col-ownership': 'Ownership', 'col-added': 'Added On',
    'col-desc': 'Description', 'col-action': 'Action'
};
let visibleColumns = {
    'col-no': true, 'col-channel': true, 'col-status': true, 'col-subs': true, 'col-username': true,
    'col-ownership': true, 'col-added': true, 'col-desc': false, 'col-action': true
};
const savedColumns = JSON.parse(localStorage.getItem('visibleColumns'));
if (savedColumns) {
    visibleColumns = { ...visibleColumns, ...savedColumns };
}


// --- Helper Functions ---

function parseSubscribers(subString) {
    if (!subString) return 0;
    let cleanStr = subString.toLowerCase().replace(/subscribers/g, '').trim().replace(/\s/g, '');
    let multiplier = 1;
    if (cleanStr.includes('k')) {
        multiplier = 1000;
        cleanStr = cleanStr.replace('k', '');
    } else if (cleanStr.includes('m')) {
        multiplier = 1000000;
        cleanStr = cleanStr.replace('m', '');
    }
    return parseFloat(cleanStr) * multiplier || 0;
}

function sortChannels(channelsList) {
    const rankedList = [...channelsList].sort((a, b) => parseSubscribers(b.subscribers) - parseSubscribers(a.subscribers));
    const rankMap = {};
    rankedList.forEach((c, index) => { rankMap[c.username] = index + 1; });

    return [...channelsList].sort((a, b) => {
        const ownershipOrder = { 'Our Channel': 1, 'Our Relative Channel': 2, 'Competitor Channel': 3 };
        const ownerA = ownershipOrder[a.ownership || 'Competitor Channel'];
        const ownerB = ownershipOrder[b.ownership || 'Competitor Channel'];
        if (ownerA !== ownerB) return ownerA - ownerB;

        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
        if (sortBy === 'subs-asc') return parseSubscribers(a.subscribers) - parseSubscribers(b.subscribers);
        if (sortBy === 'subs-desc') return parseSubscribers(b.subscribers) - parseSubscribers(a.subscribers);
        if (sortBy === 'status') {
            if (a.status === b.status) return 0;
            return a.status === 'Active' ? -1 : 1;
        }
        return 0;
    }).map(c => ({ ...c, rank: rankMap[c.username] }));
}

function formatDate(dateString) {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}


// --- Login/Auth ---

if (loginForm) {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'dashboard.html';
    }
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'dashboard.html';
            } else {
                showToast(data.message || 'Login failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    });
}


// --- Main Dashboard Logic ---

if (window.location.pathname.includes('dashboard.html')) {
    // Auth Check
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
    }

    // --- Core Data Functions (Database-driven) ---

    async function loadChannels() {
        console.log('Loading channels from database...');
        try {
            const res = await fetch(`${API_URL}/channels`);
            const result = await res.json();
            if (result.success) {
                channels = result.data;
                renderChannels();
                renderOverview(); // Also update the overview dashboard
            } else {
                showToast(result.message || 'Could not load channels.', 'error');
            }
        } catch (error) {
            showToast('Network error while loading channels.', 'error');
        }
    }

    window.removeChannel = async (username) => {
        if (!confirm(`Are you sure you want to remove @${username}?`)) return;

        try {
            const res = await fetch(`${API_URL}/channels/${username}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                showToast('Channel removed successfully.');
                loadChannels(); // Reload data from server
            } else {
                showToast(result.message || 'Failed to remove channel.', 'error');
            }
        } catch (error) {
            showToast('Network error while removing channel.', 'error');
        }
    };

    window.updateOwnership = async (username, newOwnership) => {
        try {
            const res = await fetch(`${API_URL}/channels/${username}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownership: newOwnership })
            });
            const result = await res.json();
            if (result.success) {
                showToast(`Ownership for @${username} updated.`);
                // Find and update the local channel object to avoid a full reload
                const channel = channels.find(c => c.username === username);
                if (channel) channel.ownership = newOwnership;
                renderChannels(); // Re-render to reflect sorting changes
            } else {
                showToast(result.message || 'Failed to update ownership.', 'error');
            }
        } catch (error) {
            showToast('Network error while updating ownership.', 'error');
        }
    };

    // --- UI Event Listeners ---

    // Navigation
    function switchView(viewName) {
        [viewDashboard, viewDatabase, viewAnalytics].forEach(v => v.classList.add('hidden'));
        [navDashboard, navDatabase, navAnalytics].forEach(n => n.classList.remove('active'));

        const viewMap = { dashboard: viewDashboard, database: viewDatabase, analytics: viewAnalytics };
        const navMap = { dashboard: navDashboard, database: navDatabase, analytics: navAnalytics };

        if (viewMap[viewName]) viewMap[viewName].classList.remove('hidden');
        if (navMap[viewName]) navMap[viewName].classList.add('active');

        // Render content for the activated view
        if (viewName === 'dashboard') renderOverview();
        if (viewName === 'database') renderChannels();
        if (viewName === 'analytics') renderAnalytics();

        localStorage.setItem('lastView', viewName);
    }

    [navDashboard, navDatabase, navAnalytics].forEach(nav => {
        nav.addEventListener('click', () => switchView(nav.id.replace('nav', '').toLowerCase()));
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    });

    // Modals
    openAddChannelModalBtn.addEventListener('click', () => addChannelModal.classList.remove('hidden'));
    closeAddChannelModalBtn.addEventListener('click', () => addChannelModal.classList.add('hidden'));
    addChannelModal.addEventListener('click', (e) => { if (e.target === addChannelModal) addChannelModal.classList.add('hidden'); });


    // Add Channel Button
    addChannelBtn.addEventListener('click', async () => {
        const inputVal = channelInput.value.trim();
        if (!inputVal) return showToast('Please enter at least one channel', 'error');

        const lines = inputVal.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) return showToast('Please enter valid channel names', 'error');

        addChannelBtn.textContent = `Processing ${lines.length}...`;
        addChannelBtn.disabled = true;

        let addedCount = 0, skippedCount = 0, errorCount = 0;

        for (const line of lines) {
            // Basic client-side duplicate check to avoid unnecessary API calls
            const simpleUsername = line.split('/').pop().replace('@', '');
            if (channels.some(c => c.username === simpleUsername)) {
                skippedCount++;
                continue;
            }

            try {
                const res = await fetch(`${API_URL}/channel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelIdentifier: line })
                });
                const data = await res.json();
                if (data.success) {
                    addedCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                errorCount++;
            }
        }

        let msg = [];
        if (addedCount > 0) msg.push(`Added ${addedCount}`);
        if (skippedCount > 0) msg.push(`Skipped ${skippedCount} (Duplicate)`);
        if (errorCount > 0) msg.push(`Failed ${errorCount}`);
        showToast(msg.join(', '), addedCount > 0 ? 'success' : 'error');

        if (addedCount > 0) {
            channelInput.value = '';
            addChannelModal.classList.add('hidden');
            await loadChannels(); // Reload all data from server
        }

        addChannelBtn.textContent = 'Add Channels';
        addChannelBtn.disabled = false;
    });

    // Refresh Data (force update all)
    refreshDataBtn.addEventListener('click', async () => {
        if (channels.length === 0) return showToast('No channels to refresh', 'error');

        refreshDataBtn.classList.add('loading');
        refreshDataBtn.disabled = true;
        refreshDataBtn.querySelector('span').textContent = 'Refreshing...';

        let updatedCount = 0, errorCount = 0;

        for (const channel of channels) {
            try {
                const res = await fetch(`${API_URL}/channel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelIdentifier: channel.username })
                });
                if ((await res.json()).success) updatedCount++;
                else errorCount++;
            } catch (err) {
                errorCount++;
            }
        }

        showToast(`Refresh complete: ${updatedCount} success, ${errorCount} failed.`);
        await loadChannels(); // Reload all data from server

        refreshDataBtn.classList.remove('loading');
        refreshDataBtn.disabled = false;
        refreshDataBtn.querySelector('span').textContent = 'Fetch';
    });


    // Controls (Sort, Search, View)
    function updateViewMode() {
        if (viewMode === 'card') {
            channelsGrid.classList.remove('hidden');
            channelsTableContainer.classList.add('hidden');
            cardViewBtn.classList.add('active');
            tableViewBtn.classList.remove('active');
        } else {
            channelsGrid.classList.add('hidden');
            channelsTableContainer.classList.remove('hidden');
            cardViewBtn.classList.remove('active');
            tableViewBtn.classList.add('active');
        }
        localStorage.setItem('viewMode', viewMode);
        renderChannels();
    }
    cardViewBtn.addEventListener('click', () => { viewMode = 'card'; updateViewMode(); });
    tableViewBtn.addEventListener('click', () => { viewMode = 'table'; updateViewMode(); });

    sortSelect.value = sortBy;
    sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        localStorage.setItem('sortBy', sortBy);
        renderChannels();
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderChannels();
    });

    // --- Column Visibility Logic ---
    if (columnToggleBtn) {
        columnToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            columnToggleMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!columnToggleBtn.contains(e.target) && !columnToggleMenu.contains(e.target)) {
                columnToggleMenu.classList.add('hidden');
            }
        });

        // Initialize checkboxes and listeners
        Object.keys(visibleColumns).forEach(colId => {
            const checkbox = document.getElementById(colId);
            if (checkbox) {
                checkbox.checked = visibleColumns[colId];
                checkbox.addEventListener('change', (e) => {
                    visibleColumns[colId] = e.target.checked;
                    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
                    renderChannels();
                });
            }
        });
    }

    // --- Render Functions ---

    function renderChannels() {
        let filteredChannels = searchQuery
            ? channels.filter(c => c.name.toLowerCase().includes(searchQuery) || c.username.toLowerCase().includes(searchQuery))
            : channels;

        totalCountEl.textContent = filteredChannels.length;

        const sortedChannels = sortChannels(filteredChannels);

        // Render Card View
        channelsGrid.innerHTML = '';
        sortedChannels.forEach(channel => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            if (channel.ownership === 'Our Channel') card.style.borderColor = 'var(--success-color)';
            else if (channel.ownership === 'Our Relative Channel') card.style.borderColor = 'var(--accent-color)';
            if (channel.status === 'Inactive') card.style.opacity = '0.6';

            card.onclick = (e) => { if (!e.target.matches('button, select')) window.open(`https://t.me/${channel.username}`, '_blank'); };
            card.innerHTML = `
                <img src="${channel.avatar_url || channel.image_url || 'https://via.placeholder.com/64'}" alt="${channel.name}" class="channel-img">
                <div class="channel-info">
                    <div class="channel-name">${channel.name} ${channel.status === 'Inactive' ? '<span class="status-badge status-inactive">Inactive</span>' : ''}</div>
                    <div class="channel-username">@${channel.username}</div>
                    <div class="channel-subs">${parseSubscribers(channel.subscribers).toLocaleString()} subscribers</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${channel.ownership || 'Competitor Channel'}</div>
                </div>
                <button onclick="removeChannel('${channel.username}')" class="action-btn" style="z-index:2;">✕</button>
            `;
            channelsGrid.appendChild(card);
        });

        // Render Table View
        const table = channelsTableBody.closest('table');
        const thead = table.querySelector('thead tr');
        thead.innerHTML = ''; // Clear existing headers
        columnOrder.forEach(colId => {
            const th = document.createElement('th');
            th.className = `${colId} ${visibleColumns[colId] ? '' : 'hidden'}`;
            th.textContent = columnLabels[colId];
            thead.appendChild(th);
        });

        channelsTableBody.innerHTML = '';
        sortedChannels.forEach((channel, index) => {
            const row = document.createElement('tr');
            // row.onclick removed to prevent whole-row clicking


            const ownershipOptions = ['Our Channel', 'Our Relative Channel', 'Competitor Channel']
                .map(opt => `<option value="${opt}" ${channel.ownership === opt ? 'selected' : ''}>${opt}</option>`).join('');

            const cells = {
                'col-no': `<td class="col-no ${visibleColumns['col-no'] ? '' : 'hidden'}" style="font-weight:bold; color:var(--text-secondary);">#${channel.rank}</td>`,
                'col-channel': `<td class="col-channel ${visibleColumns['col-channel'] ? '' : 'hidden'}"><div class="table-channel-info"><img src="${channel.avatar_url || channel.image_url || 'https://via.placeholder.com/40'}" class="table-channel-img" style="cursor:pointer;" onclick="window.open('https://t.me/${channel.username}', '_blank')"><span style="cursor:pointer;" onclick="window.open('https://t.me/${channel.username}', '_blank')">${channel.name}</span></div></td>`,
                'col-status': `<td class="col-status ${visibleColumns['col-status'] ? '' : 'hidden'}"><span class="status-badge ${channel.status === 'Active' ? 'status-active' : 'status-inactive'}">${channel.status || 'Active'}</span></td>`,
                'col-subs': `<td class="col-subs ${visibleColumns['col-subs'] ? '' : 'hidden'}" style="font-weight:600;">${parseSubscribers(channel.subscribers).toLocaleString()}</td>`,
                'col-username': `<td class="col-username ${visibleColumns['col-username'] ? '' : 'hidden'}" style="cursor:pointer; color:var(--accent-color);" onclick="window.open('https://t.me/${channel.username}', '_blank')">@${channel.username}</td>`,
                'col-ownership': `<td class="col-ownership ${visibleColumns['col-ownership'] ? '' : 'hidden'}"><select class="ownership-select" onchange="updateOwnership('${channel.username}', this.value)">${ownershipOptions}</select></td>`,
                'col-added': `<td class="col-added ${visibleColumns['col-added'] ? '' : 'hidden'}">${formatDate(channel.added_on || channel.created_at)}</td>`,
                'col-desc': `<td class="col-desc ${visibleColumns['col-desc'] ? '' : 'hidden'}" title="${channel.description || ''}">${channel.description || '-'}</td>`,
                'col-action': `<td class="col-action ${visibleColumns['col-action'] ? '' : 'hidden'}"><button onclick="removeChannel('${channel.username}')" class="action-btn">Remove</button></td>`
            };

            row.innerHTML = columnOrder.map(colId => cells[colId]).join('');
            channelsTableBody.appendChild(row);
        });
    }

    function renderOverview() {
        if (!overviewTableBody) return;
        const ranges = [
            { label: '0 to 1,000', min: 0, max: 1000 },
            { label: '1,000 to 3,000', min: 1000, max: 3000 },
            { label: '3,000 to 5,000', min: 3000, max: 5000 },
            { label: '5,000 to 7,500', min: 5000, max: 7500 },
            { label: '7,500 to 10,000', min: 7500, max: 10000 },
            { label: '10,000 to 15,000', min: 10000, max: 15000 },
            { label: '15,000 to 20,000', min: 15000, max: 20000 },
            { label: '20,000 to 25,000', min: 20000, max: 25000 },
            { label: '25,000+', min: 25000, max: Infinity }
        ];

        const distTotalCount = document.getElementById('distTotalCount');
        if (distTotalCount) distTotalCount.textContent = channels.length;

        overviewTableBody.innerHTML = ranges.map(range => {
            const count = channels.filter(c => {
                const subs = parseSubscribers(c.subscribers);
                return subs >= range.min && subs < range.max;
            }).length;
            return `<tr><td>${range.label}</td><td style="text-align:center;">${count}</td></tr>`;
        }).join('');
    }

    // --- Initial Load ---
    const lastView = localStorage.getItem('lastView') || 'dashboard';
    updateViewMode(); // Set initial view display
    loadChannels().then(() => {
        // Switch to the last viewed tab after data is loaded
        switchView(lastView);
    });

    // NOTE: Import and Analytics are not yet converted to use the database.
    // They will require dedicated backend endpoints and further logic changes.
}
