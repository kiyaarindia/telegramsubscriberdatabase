const API_URL = '/api'; // Use relative URL

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const openAddChannelModalBtn = document.getElementById('openAddChannelModalBtn');
const closeAddChannelModalBtn = document.getElementById('closeAddChannelModalBtn');
const addChannelModal = document.getElementById('addChannelModal');
const addChannelBtn = document.getElementById('addChannelBtn');
const editChannelModal = document.getElementById('editChannelModal');
const closeEditChannelModalBtn = document.getElementById('closeEditChannelModalBtn');
const saveEditChannelBtn = document.getElementById('saveEditChannelBtn');
const refreshDataBtn = document.getElementById('refreshDataBtn');
const refreshIntervalSelect = document.getElementById('refreshIntervalSelect');
const pinModal = null; // Removed
const channelInput = document.getElementById('channelInput');
const clearAllChannelsBtn = document.getElementById('clearAllChannelsBtn');

// Observer for live fetching
const visibleElements = new Set();
const liveUpdateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const el = entry.target;
        const username = el.dataset.username;
        if (!username) return;

        if (entry.isIntersecting) {
            visibleElements.add(el);
            const refreshInterval = parseInt(localStorage.getItem('refreshInterval')) || 60000;
            if (!el.dataset.liveFetched || (Date.now() - parseInt(el.dataset.lastFetchTime || 0)) > refreshInterval) {
                el.dataset.liveFetched = 'true';
                el.dataset.lastFetchTime = Date.now().toString();
                fetchLiveSubscribers(username, el);
            }
        } else {
            visibleElements.delete(el);
        }
    });
}, { rootMargin: '100px' });

let liveUpdateIntervalId = null;

function startLiveUpdateInterval() {
    if (liveUpdateIntervalId) clearInterval(liveUpdateIntervalId);

    let interval = parseInt(localStorage.getItem('refreshInterval')) || 60000;

    if (refreshIntervalSelect) {
        refreshIntervalSelect.value = interval.toString();

        // Remove old listener to avoid duplicates
        const newSelect = refreshIntervalSelect.cloneNode(true);
        if (refreshIntervalSelect.parentNode) {
            refreshIntervalSelect.parentNode.replaceChild(newSelect, refreshIntervalSelect);
        }

        newSelect.addEventListener('change', (e) => {
            const newInterval = parseInt(e.target.value);
            localStorage.setItem('refreshInterval', newInterval);
            startLiveUpdateInterval();
        });
    }

    // Tracker countdown timer logic
    let nextFetchTime = Date.now() + interval;
    if (window.countdownIntervalId) clearInterval(window.countdownIntervalId);

    window.countdownIntervalId = setInterval(() => {
        if (!countdownTimerEl) return;
        const remainingMs = Math.max(0, nextFetchTime - Date.now());
        const totalSeconds = Math.floor(remainingMs / 1000);

        if (totalSeconds <= 0) {
            countdownTimerEl.textContent = "00:00";
            // TRIGGER ACTUAL SYNC
            if (refreshDataBtn && !refreshDataBtn.disabled) {
                console.log('[AUTO] Triggering auto-refresh fetch...');
                refreshDataBtn.click();
            }
            nextFetchTime = Date.now() + interval; // Reset countdown after click
            return;
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            countdownTimerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            countdownTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// Start auto-fetch loop
startLiveUpdateInterval();

async function fetchLiveSubscribers(username, element) {
    try {
        const res = await fetch(`${API_URL}/channel/${username}/live`);
        const result = await res.json();
        if (result.success && result.data) {
            const data = result.data;
            const ch = channels.find(c => c.username === username);
            if (ch) {
                if (data.subscribers !== undefined) ch.subscribers = data.subscribers;
                if (data.status) ch.status = data.status;
                if (data.avatar_url) ch.avatar_url = data.avatar_url;
                if (data.name) ch.name = data.name;
                updateUIForChannel(element, ch);
            }
        }
    } catch (err) {
        console.error(`Live fetch error for ${username}:`, err);
    }
}

function updateUIForChannel(element, channel) {
    if (element.classList.contains('channel-card')) {
        const subsCell = element.querySelector('.channel-subs');
        const img = element.querySelector('.channel-img');
        const nameCell = element.querySelector('.channel-name');

        if (subsCell && channel.subscribers) {
            subsCell.textContent = `${parseSubscribers(channel.subscribers).toLocaleString()} subscribers`;
            subsCell.style.color = 'var(--success-color)';
        }
        if (img && channel.avatar_url) img.src = channel.avatar_url;
        if (nameCell && channel.name) {
            nameCell.innerHTML = `${channel.name} ${channel.status === 'Inactive' ? '<span class="status-badge status-inactive">Inactive</span>' : ''}`;
        }
        element.style.opacity = channel.status === 'Inactive' ? '0.6' : '1';
    } else if (element.tagName === 'TR') {
        const subsCell = element.querySelector('.col-subs');
        const img = element.querySelector('.table-channel-img');
        const nameCellSpan = element.querySelector('.col-channel span');
        const statusCell = element.querySelector('.col-status');

        if (subsCell && channel.subscribers) {
            subsCell.textContent = parseSubscribers(channel.subscribers).toLocaleString();
            subsCell.style.color = 'var(--success-color)';
        }
        if (img && channel.avatar_url) img.src = channel.avatar_url;
        if (nameCellSpan && channel.name) nameCellSpan.textContent = channel.name;
        if (statusCell) {
            statusCell.innerHTML = `<span class="status-badge ${channel.status === 'Active' ? 'status-active' : 'status-inactive'}">${channel.status || 'Active'}</span>`;
        }
        element.style.opacity = channel.status === 'Inactive' ? '0.8' : '1';
    }
}

const channelsGrid = document.getElementById('channelsGrid');
const channelsTableContainer = document.getElementById('channelsTableContainer');
const channelsTableBody = document.getElementById('channelsTableBody');
const toastEl = document.getElementById('toast');
const totalCountEl = document.getElementById('totalCount');
const activeCountEl = document.getElementById('activeCount');
const inactiveCountEl = document.getElementById('inactiveCount');
const countdownTimerEl = document.getElementById('countdownTimer');
const searchInput = document.getElementById('searchInput');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnToggleMenu = document.getElementById('columnToggleMenu');

// Navigation Elements
const navDashboard = document.getElementById('navDashboard');
const navDatabase = document.getElementById('navDatabase');
const navAutoSave = document.getElementById('navAutoSave');

const viewDashboard = document.getElementById('viewDashboard');
const viewDatabase = document.getElementById('viewDatabase');
const viewAutoSave = document.getElementById('viewAutoSave');
const overviewTableBody = document.getElementById('overviewTableBody');

// Auto Tracker Elements
const toggleAutoSaveBtn = document.getElementById('toggleAutoSaveBtn');
const autoSaveIntervalSelect = document.getElementById('autoSaveInterval');
const autoSaveStatus = document.getElementById('autoSaveStatus');
const trackerSearchInput = document.getElementById('trackerSearchInput');
let isAutoSaving = false;
let autoSaveIntervalId = null;
let autoSaveCountdownId = null;
let nextAutoSaveTime = 0;

// Analytics Elements (Still using localStorage as per original design)
const analyticsTableBody = document.getElementById('analyticsTableBody');
const analyticsCountEl = document.getElementById('analyticsCount');
const forceRecordBtn = document.getElementById('forceRecordBtn');
const clearAnalyticsBtn = document.getElementById('clearAnalyticsBtn');

// --- State ---
let channels = []; // This will be populated from the database
let analyticsHistory = [];
let viewMode = localStorage.getItem('viewMode') || 'table';
let sortBy = localStorage.getItem('sortBy') || 'subs';
let sortDesc = localStorage.getItem('sortDesc') === 'true'; // Default true for subs
let searchQuery = '';

// --- Column Configuration (Kept in localStorage for user preference) ---
const defaultColumnOrder = [
    'col-no', 'col-channel', 'col-subs', 'col-username',
    'col-ownership', 'col-status', 'col-added', 'col-synced', 'col-desc', 'col-action', 'col-delete'
];
let columnOrder = JSON.parse(localStorage.getItem('columnOrder'));
if (!columnOrder) {
    columnOrder = defaultColumnOrder;
} else {
    // Hard fix: Ensure col-synced is present
    if (columnOrder.indexOf('col-synced') === -1) {
        const addedIdx = columnOrder.indexOf('col-added');
        if (addedIdx !== -1) {
            columnOrder.splice(addedIdx + 1, 0, 'col-synced');
        } else {
            columnOrder.push('col-synced');
        }
    }
}
localStorage.setItem('columnOrder', JSON.stringify(columnOrder));
const columnLabels = {
    'col-no': 'No.', 'col-channel': 'Channel', 'col-status': 'Status', 'col-subs': 'Subscribers',
    'col-username': 'Username', 'col-ownership': 'Ownership', 'col-added': 'Added On', 'col-synced': 'Last Sync',
    'col-desc': 'Description', 'col-action': 'Edit', 'col-delete': 'Delete'
};
let visibleColumns = {
    'col-no': true, 'col-channel': true, 'col-status': true, 'col-subs': true, 'col-username': true,
    'col-ownership': true, 'col-added': true, 'col-synced': true, 'col-desc': false, 'col-action': true, 'col-delete': true
};
const savedColumns = JSON.parse(localStorage.getItem('visibleColumns'));
if (savedColumns) {
    visibleColumns = { ...visibleColumns, ...savedColumns };
}
// Force col-synced to true if it was missing 
if (visibleColumns['col-synced'] === undefined) {
    visibleColumns['col-synced'] = true;
}
localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));


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

        // Priority 1: Always sort by Ownership first
        if (ownerA !== ownerB) {
            return ownerA - ownerB;
        }

        // Priority 2: Sort by the user's selected column *within* those ownership groups
        let comparison = 0;
        if (sortBy === 'col-no') {
            comparison = a.rank - b.rank;
        } else if (sortBy === 'col-channel' || sortBy === 'col-username') {
            comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'col-subs') {
            comparison = parseSubscribers(a.subscribers) - parseSubscribers(b.subscribers);
        } else if (sortBy === 'col-status') {
            const statusA = a.status || 'Active';
            const statusB = b.status || 'Active';
            if (statusA !== statusB) comparison = statusA === 'Active' ? -1 : 1;
        } else if (sortBy === 'col-added') {
            const dateA = new Date(a.added_on || a.created_at).getTime() || 0;
            const dateB = new Date(b.added_on || b.created_at).getTime() || 0;
            comparison = dateA - dateB;
        } else if (sortBy === 'col-ownership') {
            // If they clicked the ownership column itself, just sort by ownership desc/asc
            comparison = ownerA - ownerB;
        }

        return sortDesc ? -comparison : comparison;
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

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
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

    async function loadAnalytics() {
        console.log('Loading analytics from database...');
        try {
            const res = await fetch(`${API_URL}/analytics`);
            const result = await res.json();
            if (result.success) {
                analyticsHistory = result.data;
                if (viewAutoSave && !viewAutoSave.classList.contains('hidden')) {
                    renderTrackerTable();
                }
            } else {
                console.error('Failed to load analytics:', result.message);
            }
        } catch (error) {
            console.error('Network error loading analytics:', error);
        }
    }

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

    window.removeChannel = async (e, username) => {
        if (e && e.stopPropagation) {
            e.stopPropagation(); // Prevent card click from opening Telegram
        }

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

    window.openEditModal = (username) => {
        const channel = channels.find(c => c.username === username);
        if (!channel) return;

        document.getElementById('editChannelOriginalUsername').value = channel.username;
        document.getElementById('editChannelUsername').value = channel.username; // The visible input
        document.getElementById('editChannelName').value = channel.name || '';

        editChannelModal.classList.remove('hidden');
    };

    saveEditChannelBtn.addEventListener('click', async () => {
        const originalUsername = document.getElementById('editChannelOriginalUsername').value;
        const newUsernameInput = document.getElementById('editChannelUsername').value.trim();
        const name = document.getElementById('editChannelName').value.trim();

        if (!originalUsername) return showToast('Error identifying channel.', 'error');
        if (!newUsernameInput) return showToast('Telegram ID cannot be empty.', 'error');

        // Remove @ if user added it
        const cleanNewUsername = newUsernameInput.replace('@', '');

        saveEditChannelBtn.textContent = 'Saving...';
        saveEditChannelBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/channels/${originalUsername}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newUsername: cleanNewUsername !== originalUsername ? cleanNewUsername : undefined,
                    name: name || undefined
                })
            });
            const result = await res.json();

            if (result.success) {
                showToast(`Details updated.`);

                // Update local state
                const channelIndex = channels.findIndex(c => c.username === originalUsername);
                if (channelIndex !== -1) {
                    if (result.newUsername) channels[channelIndex].username = result.newUsername;
                    if (name !== undefined) channels[channelIndex].name = name;
                }

                editChannelModal.classList.add('hidden');
                renderChannels();
            } else {
                if (result.isDuplicate) {
                    showToast(result.message, 'error');
                } else {
                    showToast(result.message || 'Failed to update channel details.', 'error');
                }
            }
        } catch (error) {
            showToast('Network error while updating channel.', 'error');
        } finally {
            saveEditChannelBtn.textContent = 'Save Changes';
            saveEditChannelBtn.disabled = false;
        }
    });

    // --- UI Event Listeners ---

    // Navigation
    function switchView(viewName) {
        // Safely hide all views and deactivate nav items
        [viewDashboard, viewDatabase, viewAutoSave].forEach(v => {
            if (v) v.classList.add('hidden');
        });
        [navDashboard, navDatabase, navAutoSave].forEach(n => {
            if (n) n.classList.remove('active');
        });

        const viewMap = { dashboard: viewDashboard, database: viewDatabase, autosave: viewAutoSave };
        const navMap = { dashboard: navDashboard, database: navDatabase, autosave: navAutoSave };

        if (viewMap[viewName]) viewMap[viewName].classList.remove('hidden');
        if (navMap[viewName]) navMap[viewName].classList.add('active');

        // Render content for the activated view
        if (viewName === 'dashboard') renderOverview();
        if (viewName === 'database') renderChannels();
        if (viewName === 'autosave') renderTrackerTable();

        localStorage.setItem('lastView', viewName);
    }

    [navDashboard, navDatabase, navAutoSave].forEach(nav => {
        if (nav) nav.addEventListener('click', () => switchView(nav.id.replace('nav', '').toLowerCase()));
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    });

    // Modals
    openAddChannelModalBtn.addEventListener('click', () => addChannelModal.classList.remove('hidden'));
    closeAddChannelModalBtn.addEventListener('click', () => addChannelModal.classList.add('hidden'));
    addChannelModal.addEventListener('click', (e) => { if (e.target === addChannelModal) addChannelModal.classList.add('hidden'); });

    closeEditChannelModalBtn.addEventListener('click', () => editChannelModal.classList.add('hidden'));
    editChannelModal.addEventListener('click', (e) => { if (e.target === editChannelModal) editChannelModal.classList.add('hidden'); });


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

    // Refresh Data (with Client-Side Chunking)
    refreshDataBtn.addEventListener('click', async () => {
        if (channels.length === 0) return showToast('No channels to refresh', 'error');

        refreshDataBtn.classList.add('loading');
        refreshDataBtn.disabled = true;
        const btnText = refreshDataBtn.querySelector('span');
        const originalText = 'Fetch';

        const BATCH_SIZE = 5; // Small batch to prevent timeouts
        let totalUpdated = 0;
        let totalFailed = 0;

        try {
            for (let i = 0; i < channels.length; i += BATCH_SIZE) {
                const batch = channels.slice(i, i + BATCH_SIZE);
                const currentCount = Math.min(i + BATCH_SIZE, channels.length);

                // Update UI
                btnText.textContent = `Syncing ${currentCount}/${channels.length}...`;

                // Send Batch
                const res = await fetch(`${API_URL}/channels/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channels: batch })
                });

                const result = await res.json();
                if (result.success && result.stats) {
                    totalUpdated += result.stats.updated;
                    totalFailed += result.stats.failed;
                }
            }

            // Completed
            showToast(`Sync Complete! Updated: ${totalUpdated}, Failed: ${totalFailed}`);
            await loadChannels(); // Reload data to show changes
            await loadAnalytics(); // Refresh history as well

        } catch (err) {
            console.error(err);
            showToast('Network error during sync (Check console)', 'error');
        } finally {
            refreshDataBtn.classList.remove('loading');
            refreshDataBtn.disabled = false;
            btnText.textContent = originalText;
        }
    });

    // Clear All Channels
    if (clearAllChannelsBtn) {
        clearAllChannelsBtn.addEventListener('click', async () => {
            if (channels.length === 0) return showToast('No channels to remove.', 'error');

            if (!confirm(`WARNING: Are you sure you want to remove ALL ${channels.length} channels? This cannot be undone.`)) return;

            clearAllChannelsBtn.disabled = true;
            clearAllChannelsBtn.textContent = 'Clearing...';

            try {
                const res = await fetch(`${API_URL}/channels`, { method: 'DELETE' });
                const result = await res.json();
                if (result.success) {
                    showToast('All channels removed successfully.');
                    await loadChannels(); // Refresh UI
                } else {
                    showToast(result.message || 'Failed to clear database.', 'error');
                }
            } catch (err) {
                showToast('Network error while clearing database.', 'error');
            } finally {
                clearAllChannelsBtn.disabled = false;
                clearAllChannelsBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Clear All</span>`;
            }
        });
    }


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

        if (totalCountEl) totalCountEl.textContent = filteredChannels.length;

        const activeChannels = filteredChannels.filter(c => c.status !== 'Inactive');
        const inactiveChannels = filteredChannels.filter(c => c.status === 'Inactive');

        if (activeCountEl) activeCountEl.textContent = activeChannels.length;
        if (inactiveCountEl) inactiveCountEl.textContent = inactiveChannels.length;

        const sortedChannels = sortChannels(filteredChannels);

        // Render Card View
        channelsGrid.innerHTML = '';
        sortedChannels.forEach(channel => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            card.dataset.username = channel.username; // For live fetch tracking
            if (channel.ownership === 'Our Channel') card.style.borderColor = 'var(--success-color)';
            else if (channel.ownership === 'Our Relative Channel') card.style.borderColor = 'var(--accent-color)';
            if (channel.status === 'Inactive') card.style.opacity = '0.6';

            const imageUrl = channel.avatar_url || channel.image_url;
            const finalImgSrc = imageUrl ? (imageUrl.startsWith('data:') ? imageUrl : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`) : 'https://via.placeholder.com/64';
            card.innerHTML = `
                <img src="${finalImgSrc}" alt="${channel.name}" class="channel-img">
                <div class="channel-info">
                    <div class="channel-name">${channel.name} ${channel.status === 'Inactive' ? '<span class="status-badge status-inactive">Inactive</span>' : ''}</div>
                    <div class="channel-username" style="cursor:pointer; color:var(--accent-color);" onclick="window.open('https://t.me/${channel.username}', '_blank')">@${channel.username}</div>
                    <div class="channel-subs">${parseSubscribers(channel.subscribers).toLocaleString()} subscribers</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${channel.ownership || 'Competitor Channel'}</div>
                </div>
                <button onclick="removeChannel(event, '${channel.username}')" class="action-btn" style="z-index:2;">✕</button>
            `;
            channelsGrid.appendChild(card);
            liveUpdateObserver.observe(card); // Attach observer
        });

        const table = channelsTableBody.closest('table');
        const thead = table.querySelector('thead tr');
        thead.innerHTML = ''; // Clear existing headers

        // Only get columns that are actually visible
        const activeColumns = columnOrder.filter(colId => visibleColumns[colId]);

        activeColumns.forEach(colId => {
            const th = document.createElement('th');
            th.className = colId;
            // Added cursor and sorting arrow
            th.style.cursor = 'pointer';
            let sortArrow = '';
            if (sortBy === colId) {
                sortArrow = sortDesc ? ' ▼' : ' ▲';
            }
            th.innerHTML = `${columnLabels[colId]}<span style="font-size: 0.8rem; opacity: 0.7;">${sortArrow}</span>`;

            // Add click event for sorting
            th.addEventListener('click', () => {
                if (sortBy === colId) {
                    sortDesc = !sortDesc; // Toggle if clicking same column
                } else {
                    sortBy = colId;
                    sortDesc = true; // Default to descending for new column
                }
                localStorage.setItem('sortBy', sortBy);
                localStorage.setItem('sortDesc', sortDesc);
                renderChannels();
            });

            thead.appendChild(th);
        });

        channelsTableBody.innerHTML = '';
        sortedChannels.forEach((channel, index) => {
            const row = document.createElement('tr');
            row.dataset.username = channel.username; // For live fetch tracking
            // row.onclick removed to prevent whole-row clicking


            const ownershipOptions = ['Our Channel', 'Our Relative Channel', 'Competitor Channel']
                .map(opt => `<option value="${opt}" ${channel.ownership === opt ? 'selected' : ''}>${opt}</option>`).join('');

            const cells = {
                'col-no': `<td class="col-no" style="font-weight:bold; color:var(--text-secondary);">#${channel.rank}</td>`,
                'col-channel': (() => {
                    const imageUrl = channel.avatar_url || channel.image_url;
                    const finalImgSrc = imageUrl ? (imageUrl.startsWith('data:') ? imageUrl : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`) : 'https://via.placeholder.com/40';
                    return `<td class="col-channel"><div class="table-channel-info"><img src="${finalImgSrc}" class="table-channel-img"><span style="cursor:default;">${channel.name}</span></div></td>`;
                })(),
                'col-status': `<td class="col-status"><span class="status-badge ${channel.status === 'Active' ? 'status-active' : 'status-inactive'}">${channel.status || 'Active'}</span></td>`,
                'col-subs': `<td class="col-subs" style="font-weight:600;">${parseSubscribers(channel.subscribers).toLocaleString()}</td>`,
                'col-username': `<td class="col-username" style="cursor:pointer; color:var(--accent-color);" onclick="window.open('https://t.me/${channel.username}', '_blank')">@${channel.username}</td>`,
                'col-ownership': `<td class="col-ownership"><select class="ownership-select" onchange="updateOwnership('${channel.username}', this.value)">${ownershipOptions}</select></td>`,
                'col-added': `<td class="col-added">${formatDate(channel.added_on || channel.created_at)}</td>`,
                'col-synced': `<td class="col-synced" style="font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(channel.last_synced_at)}</td>`,
                'col-desc': `<td class="col-desc" title="${channel.description || ''}">${channel.description || '-'}</td>`,
                'col-action': `<td class="col-action" style="white-space: nowrap;"><button onclick="openEditModal('${channel.username}')" class="secondary-btn" style="padding: 0.25rem 0.6rem; font-size: 0.8rem; background: var(--border-color); color: var(--text-color); border: none;">Edit</button></td>`,
                'col-delete': `<td class="col-delete" style="white-space: nowrap;"><button onclick="removeChannel(event, '${channel.username}')" class="action-btn">Remove</button></td>`
            };

            row.innerHTML = activeColumns.map(colId => cells[colId]).join('');
            channelsTableBody.appendChild(row);
            liveUpdateObserver.observe(row); // Attach observer
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

    function renderAnalyticsTable(targetHeader, targetBody, countEl, channelCountEl = null, searchQuery = '') {
        if (!targetBody) return;
        targetHeader.innerHTML = '';
        targetBody.innerHTML = '';

        const query = (searchQuery || '').toLowerCase().trim();

        if (analyticsHistory.length === 0) {
            targetBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1rem;">No history recorded yet.</td></tr>';
            if (countEl) countEl.textContent = '0';
            if (channelCountEl) channelCountEl.textContent = '0';
            return;
        }

        // 1. Identify all unique channels 
        const channelMap = new Map(); // username -> metadata

        // First, add all CURRENT channels from the master list
        channels.forEach(c => {
            if (c.username) {
                channelMap.set(c.username, {
                    name: c.name,
                    ownership: c.ownership || 'Competitor Channel',
                    subscribers: parseSubscribers(c.subscribers)
                });
            }
        });

        // Then, add legacy channels from history (in case they were deleted from DB)
        analyticsHistory.forEach(record => {
            if (Array.isArray(record.details)) {
                record.details.forEach(c => {
                    if (c.username && !channelMap.has(c.username)) {
                        channelMap.set(c.username, {
                            name: c.name,
                            ownership: 'Competitor Channel', // Default legacy
                            subscribers: parseSubscribers(c.subscribers)
                        });
                    }
                });
            }
        });

        // Update total channel count
        if (channelCountEl) channelCountEl.textContent = channelMap.size;

        const ownershipPriority = {
            'Our Channel': 1,
            'Our Relative Channel': 2,
            'Competitor Channel': 3
        };

        // Sort channel keys by Ownership Priority, then by Subscribers (High to Low)
        let sortedChannelKeys = Array.from(channelMap.keys()).sort((a, b) => {
            const infoA = channelMap.get(a);
            const infoB = channelMap.get(b);

            const pA = ownershipPriority[infoA.ownership] || 99;
            const pB = ownershipPriority[infoB.ownership] || 99;

            if (pA !== pB) return pA - pB;
            return infoB.subscribers - infoA.subscribers; // Descending
        });

        // If searching, we might want to hide columns that don't match? 
        // Or if searching, only show rows that match the date?
        // Let's filter ROWS based on date/time OR matching values.

        // Removed row filtering based on search query for jump-to-column behavior
        const filteredHistory = analyticsHistory;

        if (countEl) countEl.textContent = filteredHistory.length;

        // 2. Build Header Row
        let headerHTML = `
            <tr>
                <th style="min-width: 120px; position: sticky; left: 0; z-index: 10; background: var(--glass-bg);">Date</th>
                <th style="min-width: 100px;">Day</th>
                <th style="min-width: 100px;">Time</th>
        `;

        sortedChannelKeys.forEach(username => {
            const info = channelMap.get(username);
            headerHTML += `<th style="min-width: 150px; text-align: center;" title="@${username}" data-username="${username}">
                <div class="channel-name" style="font-size: 0.9rem; line-height: 1.2;">${info.name}</div>
                <div style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">@${username}</div>
            </th>`;
        });
        headerHTML += '</tr>';
        targetHeader.innerHTML = headerHTML;

        // 3. Build Data Rows (No filtering by search query as per user request for "jump" behavior)
        filteredHistory.forEach(record => {
            const dateObj = new Date(record.created_at || record.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour12: false });

            const snapshotData = {};
            if (Array.isArray(record.details)) {
                record.details.forEach(c => {
                    if (c.username) snapshotData[c.username] = c.subscribers;
                });
            }

            let rowHTML = `
                <tr>
                    <td style="position: sticky; left: 0; background: var(--glass-bg); z-index: 5; font-weight: 600; color: var(--accent-color);">${dateStr}</td>
                    <td style="color: var(--text-secondary);">${dayStr}</td>
                    <td style="font-family: monospace; font-weight: bold;">${timeStr}</td>
            `;

            sortedChannelKeys.forEach(username => {
                const rawSubs = snapshotData[username];
                let cellContent = '-';
                if (rawSubs !== undefined) {
                    const val = parseSubscribers(rawSubs);
                    cellContent = val.toLocaleString();
                }
                rowHTML += `<td style="text-align: center; font-weight: 500;">${cellContent}</td>`;
            });

            rowHTML += '</tr>';
            targetBody.innerHTML += rowHTML;
        });
    }


    function renderTrackerTable() {
        renderAnalyticsTable(
            document.getElementById('trackerTableHeader'),
            document.getElementById('trackerTableBody'),
            document.getElementById('analyticsCount'),
            document.getElementById('analyticsChannelCount')
        );
    }

    // Connect Analytics Buttons

    if (clearAnalyticsBtn) {
        clearAnalyticsBtn.addEventListener('click', async () => {
            if (!confirm('Clear ALL analytics history? This cannot be undone.')) return;
            try {
                const res = await fetch(`${API_URL}/analytics`, { method: 'DELETE' });
                const result = await res.json();
                if (result.success) {
                    showToast('History cleared.');
                    analyticsHistory = [];
                    renderAnalytics();
                    renderTrackerTable();
                } else {
                    showToast('Failed to clear history.', 'error');
                }
            } catch (err) {
                showToast('Network error clearing history.', 'error');
            }
        });
    }

    // Unified Snapshot Trigger
    if (toggleAutoSaveBtn) {
        toggleAutoSaveBtn.addEventListener('click', async () => {
            toggleAutoSaveBtn.disabled = true;
            toggleAutoSaveBtn.innerHTML = '<span>Processing...</span>';

            try {
                const res = await fetch(`${API_URL}/analytics`, { method: 'POST' });
                const result = await res.json();
                if (result.success) {
                    showToast('Snapshot recorded successfully.');
                    await loadAnalytics();
                } else {
                    showToast('Failed to record snapshot.', 'error');
                }
            } catch (err) {
                showToast('Network error recording snapshot.', 'error');
            } finally {
                toggleAutoSaveBtn.disabled = false;
                toggleAutoSaveBtn.innerHTML = '<span>Record Now</span>';
            }
        });
    }

    function jumpToColumn(query, tableId) {
        if (!query) return;
        const normalizedQuery = query.toLowerCase().trim();
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = table.querySelectorAll('th[data-username]');
        for (const th of headers) {
            const name = th.querySelector('.channel-name')?.textContent.toLowerCase() || '';
            const username = th.dataset.username.toLowerCase();
            if (name.includes(normalizedQuery) || username.includes(normalizedQuery)) {
                th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                // Subtle highlight
                th.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                setTimeout(() => th.style.backgroundColor = '', 1500);
                break;
            }
        }
    }

    if (trackerSearchInput) {
        trackerSearchInput.addEventListener('input', (e) => {
            jumpToColumn(e.target.value, 'trackerTable');
        });
    }

    const analyticsSearchInput = document.getElementById('analyticsSearchInput');
    if (analyticsSearchInput) {
        analyticsSearchInput.addEventListener('input', (e) => {
            jumpToColumn(e.target.value, 'analyticsTable');
        });
    }


    if (toggleAutoSaveBtn) {
        toggleAutoSaveBtn.innerHTML = '<span>Trigger Snapshot Now</span>';
    }

    // --- Initial Load ---
    const lastView = localStorage.getItem('lastView') || 'dashboard';
    updateViewMode(); // Set initial view display
    loadChannels().then(() => {
        loadAnalytics(); // Load analytics as well
        // Switch to the last viewed tab after data is loaded
        switchView(lastView);
    });

    // NOTE: Import and Analytics are not yet converted to use the database.
    // They will require dedicated backend endpoints and further logic changes.
}
