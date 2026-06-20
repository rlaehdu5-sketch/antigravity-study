// ----------------------------------------------------
// 1. STATE MANAGEMENT
// ----------------------------------------------------
// Embedded read-only TMDB API keys (will rotate if rate limited or failed)
const TMDB_KEYS = [
  "8265bd1679663a7ea12ac168da84d2e8",
  "4a3b711b8b93e37f0e5b7e60862ede0a",
  "2dca580c2a14b55200e784d157207b4d"
];
let tmdbKeyIndex = 0;

let state = {
  wishlist: [],
  logs: [],
  searchResults: [],
  currentTab: "wishlistPage",
  currentCalendarDate: new Date(),
  selectedDate: new Date(),
  searchDebounceTimer: null,
  wishlistFilter: "all"
};

// Temporary storage for uploaded image base64 data
let uploadedImageBase64 = "";

function getTmdbKey() {
  return TMDB_KEYS[tmdbKeyIndex % TMDB_KEYS.length];
}

// Load data from LocalStorage
function loadStateFromStorage() {
  const storedWishlist = localStorage.getItem("cinelog_wishlist");
  const storedLogs = localStorage.getItem("cinelog_logs");

  if (storedWishlist) state.wishlist = JSON.parse(storedWishlist);
  if (storedLogs) state.logs = JSON.parse(storedLogs);
  
  state.selectedDate = new Date();
}

// Save to LocalStorage
function saveWishlistToStorage() {
  localStorage.setItem("cinelog_wishlist", JSON.stringify(state.wishlist));
}

// Save Logs to LocalStorage
function saveLogsToStorage() {
  localStorage.setItem("cinelog_logs", JSON.stringify(state.logs));
}

// Initialize application state
function initApp() {
  loadStateFromStorage();
  setupEventListeners();
  
  // Starts as clean empty state by default
  renderWishlist();
  renderCalendar();
  updateSelectedDayLogs();
  lucide.createIcons();
}

// ----------------------------------------------------
// 2. UI RENDERING METHODS
// ----------------------------------------------------

// Switch between navigation tabs
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  document.querySelectorAll(".page").forEach(page => {
    if (page.id === tabId) {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  });

  state.currentTab = tabId;
  if (tabId === "calendarPage") {
    renderCalendar();
    updateSelectedDayLogs();
  } else {
    renderWishlist();
  }
  lucide.createIcons();
}

// Render the Wishlist Grid
function renderWishlist() {
  const grid = document.getElementById("wishlistGrid");
  grid.innerHTML = "";

  const filtered = state.wishlistFilter === "all"
    ? state.wishlist
    : state.wishlist.filter(item => item.type === state.wishlistFilter);

  if (state.wishlist.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="film" class="empty-state-icon" style="width: 64px; height: 64px;"></i>
        <h3 class="empty-state-title">찜 목록이 비어있습니다</h3>
        <p class="empty-state-desc">상단 검색창에 영화 제목을 검색하거나 "직접 추가" 버튼을 눌러 채워보세요!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="filter-x" class="empty-state-icon" style="width: 64px; height: 64px;"></i>
        <h3 class="empty-state-title">${state.wishlistFilter === 'movie' ? '영화' : '시리즈'} 종류의 찜 목록이 없어요</h3>
        <p class="empty-state-desc">다른 필터를 선택하거나 작품을 추가해보세요!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "media-card";
    
    let posterElement = "";
    if (item.poster) {
      posterElement = `<img src="${item.poster}" alt="${item.title}" class="card-poster" onerror="this.style.display='none'; this.parentNode.querySelector('.card-poster-placeholder').style.display='flex'">`;
    }
    
    card.innerHTML = `
      <div class="card-poster-wrapper">
        <span class="badge ${item.type === 'movie' ? 'badge-movie' : 'badge-tv'} card-badge">${item.type === 'movie' ? '영화' : '시리즈'}</span>
        ${posterElement}
        <div class="card-poster-placeholder" style="display: ${item.poster ? 'none' : 'flex'}">
          <i data-lucide="film" style="width: 36px; height: 36px;"></i>
          <span>${item.title}</span>
        </div>
      </div>
      <div class="card-content">
        <h3 class="card-title" title="${item.title}">${item.title}</h3>
        <div class="card-meta">
          <span class="badge ${item.type === 'movie' ? 'badge-movie' : 'badge-tv'}">${item.type === 'movie' ? '영화' : '시리즈'}</span>
          ${item.year ? `<span class="card-year">${item.year}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-watched" onclick="openLogModalFromWish('${item.id}')">
            <i data-lucide="check"></i> 봤어요
          </button>
          <button class="btn btn-remove" onclick="removeFromWishlist('${item.id}')" title="찜 해제">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  lucide.createIcons();
}

// Set Wishlist Filter and re-render
function setWishlistFilter(filter) {
  state.wishlistFilter = filter;
  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderWishlist();
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  // Update Header Text
  document.getElementById("calMonthTitle").textContent = `${year}년 ${month + 1}월`;

  // Weekday Header Row
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  weekdays.forEach(day => {
    const div = document.createElement("div");
    div.className = "weekday";
    div.textContent = day;
    grid.appendChild(div);
  });

  // Calendar dates calculations
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  // Render days from previous month (padding)
  for (let i = firstDayIndex; i > 0; i--) {
    const cell = document.createElement("div");
    cell.className = "day-cell outside";
    
    const dayNum = prevTotalDays - i + 1;
    cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
    grid.appendChild(cell);
  }

  // Render current month days
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Match today
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      cell.classList.add("today");
    }

    // Match selected day
    if (state.selectedDate.getFullYear() === year && state.selectedDate.getMonth() === month && state.selectedDate.getDate() === day) {
      cell.classList.add("selected");
    }

    cell.innerHTML = `<span class="day-number">${day}</span>`;

    // Check if there are viewing logs for this date
    const dayLogs = state.logs.filter(log => log.date === dateStr);
    if (dayLogs.length > 0) {
      const indicators = document.createElement("div");
      indicators.className = "event-indicators";
      
      dayLogs.slice(0, 3).forEach(log => {
        const dot = document.createElement("div");
        dot.className = `indicator-dot ${log.type === 'tv' ? 'tv' : log.type === 'anime' ? 'anime' : ''}`;
        dot.title = log.title;
        indicators.appendChild(dot);
      });
      cell.appendChild(indicators);
    }

    // Cell Click Handler
    cell.addEventListener("click", () => {
      state.selectedDate = new Date(year, month, day);
      document.querySelectorAll(".day-cell").forEach(c => c.classList.remove("selected"));
      cell.classList.add("selected");
      updateSelectedDayLogs();
    });

    grid.appendChild(cell);
  }

  // Render days from next month
  const currentCellCount = firstDayIndex + totalDays;
  const totalCellsNeeded = currentCellCount > 35 ? 42 : 35;
  const finalPadding = totalCellsNeeded - currentCellCount;

  for (let i = 1; i <= finalPadding; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell outside";
    cell.innerHTML = `<span class="day-number">${i}</span>`;
    grid.appendChild(cell);
  }
}

// Update Logs display on the right side panel
function updateSelectedDayLogs() {
  const container = document.getElementById("dailyLogsContainer");
  const dateStr = formatDate(state.selectedDate);
  
  document.getElementById("logSelectedDateText").textContent = dateStr;
  container.innerHTML = "";

  const dayLogs = state.logs.filter(log => log.date === dateStr);

  if (dayLogs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <i data-lucide="calendar-days" class="empty-state-icon" style="width: 42px; height: 42px; margin-bottom: 1rem;"></i>
        <p class="empty-state-title" style="font-size: 0.95rem;">시청 기록이 없습니다</p>
        <p class="empty-state-desc" style="font-size: 0.8rem; max-width: 100%;">이날 시청하신 작품이 있다면 찜 목록에서 '봤어요'를 눌러 남겨보세요!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  dayLogs.forEach(log => {
    const card = document.createElement("div");
    card.className = "log-item-card";

    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<i data-lucide="star" style="fill: ${i <= log.rating ? 'var(--star-color)' : 'none'}; width: 14px; height: 14px;"></i>`;
    }

    let posterElement = "";
    if (log.poster) {
      posterElement = `<img src="${log.poster}" alt="${log.title}" class="log-poster" onerror="this.style.display='none'; this.parentNode.querySelector('.log-poster-placeholder').style.display='flex'">`;
    }

    card.innerHTML = `
      ${posterElement}
      <div class="log-poster-placeholder" style="display: ${log.poster ? 'none' : 'flex'}">
        <i data-lucide="film" style="width: 20px; height: 20px;"></i>
      </div>
      <div class="log-details">
        <div class="log-title-row">
          <span class="log-title">${log.title}</span>
          <div class="log-actions">
            <button class="log-action-btn edit" onclick="openEditLogModal('${log.id}')" title="수정">
              <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="log-action-btn delete" onclick="deleteLog('${log.id}')" title="삭제">
              <i data-lucide="trash" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </div>
        <div class="log-meta">
          <span class="badge ${log.type === 'movie' ? 'badge-movie' : 'badge-tv'}">${log.type === 'movie' ? '영화' : '시리즈'}</span>
          <span>${log.year ? log.year + ' 년' : '연도 미상'}</span>
          <div class="log-stars">${starsHtml}</div>
        </div>
        ${log.review ? `<p class="log-review">${escapeHtml(log.review)}</p>` : `<p class="log-review" style="color: var(--text-muted); font-style: italic; border-left-color: var(--card-border);">한 줄 후기가 없습니다.</p>`}
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

// ----------------------------------------------------
// 3. WISH LIST CONTROLLERS
// ----------------------------------------------------
function removeFromWishlist(id) {
  state.wishlist = state.wishlist.filter(w => w.id !== id);
  saveWishlistToStorage();
  renderWishlist();
}

// ----------------------------------------------------
// 4. TMDB SEARCH ENGINE (API FETCH INTEGRATION)
// ----------------------------------------------------
async function performSearch(query) {
  const suggestionsPanel = document.getElementById("searchSuggestions");
  if (!query || query.trim() === "") {
    suggestionsPanel.innerHTML = "";
    suggestionsPanel.classList.remove("active");
    return;
  }

  suggestionsPanel.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:0.9rem;">🔍 검색 중...</div>`;
  suggestionsPanel.classList.add("active");

  try {
    const key = getTmdbKey();
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(query)}&language=ko-KR&include_adult=false`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error("TMDB Response Error");
    const data = await response.json();

    const results = (data.results || [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(item => ({
        id: `tmdb-${item.id}`,
        title: item.title || item.name || "제목 없음",
        type: item.media_type,
        year: (item.release_date || item.first_air_date || "").slice(0, 4),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null
      }));

    state.searchResults = results;
    renderSuggestions(results);
  } catch (err) {
    console.warn("TMDB failed, rotating keys:", err);
    tmdbKeyIndex++;
    suggestionsPanel.innerHTML = `
      <div style="padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--text-muted);">
        검색 결과 로드 실패 (네트워크 연결 혹은 API 한도 도달)<br>
        <span style="font-size: 0.75rem; color: var(--accent-purple);">"직접 추가" 버튼을 눌러 등록할 수 있습니다.</span>
      </div>
    `;
  }
}

function renderSuggestions(results) {
  const panel = document.getElementById("searchSuggestions");
  panel.innerHTML = "";

  if (results.length === 0) {
    panel.innerHTML = `
      <div style="padding: 1.25rem; text-align: center; font-size: 0.9rem;">
        <div style="color: #ef4444; font-weight: 700; margin-bottom: 0.5rem;">검색 결과가 없습니다</div>
        <div style="color: var(--text-muted); font-size: 0.8rem;">검색어가 정확한지 확인하시거나 "직접 추가" 버튼을 사용해 보세요.</div>
      </div>
    `;
    panel.classList.add("active");
    return;
  }

  results.forEach(item => {
    const row = document.createElement("div");
    row.className = "suggestion-item";
    
    let posterHtml = `<div class="suggestion-poster"><i data-lucide="film" style="width: 16px; height: 16px; color: var(--text-muted)"></i></div>`;
    if (item.poster) {
      posterHtml = `<img src="${item.poster}" alt="${item.title}" class="suggestion-poster" onerror="this.outerHTML='<div class=&quot;suggestion-poster&quot;><i data-lucide=&quot;film&quot;></i></div>'">`;
    }

    const isWishlisted = state.wishlist.some(w => w.id === item.id);

    row.innerHTML = `
      ${posterHtml}
      <div class="suggestion-info">
        <div class="suggestion-title">${item.title}</div>
        <div class="suggestion-meta">
          <span class="badge ${item.type === 'movie' ? 'badge-movie' : 'badge-tv'}">${item.type === 'movie' ? '영화' : '시리즈'}</span>
          <span>${item.year ? item.year + ' 년' : '연도 미상'}</span>
        </div>
      </div>
      <button class="suggestion-action-btn" onclick="event.stopPropagation(); addToWishlist('${item.id}')">
        ${isWishlisted ? '<i data-lucide="check"></i> 찜됨' : '<i data-lucide="plus"></i> 찜하기'}
      </button>
    `;
    
    row.addEventListener("click", () => {
      addToWishlist(item.id);
    });

    panel.appendChild(row);
  });

  panel.classList.add("active");
  lucide.createIcons();
}

function addToWishlist(itemId) {
  const item = state.searchResults.find(s => s.id === itemId);
  if (!item) return;

  if (state.wishlist.some(w => w.id === item.id)) {
    alert("이미 찜 목록에 추가된 작품입니다.");
    return;
  }

  state.wishlist.unshift({
    id: item.id,
    title: item.title,
    type: item.type,
    year: item.year,
    poster: item.poster
  });

  saveWishlistToStorage();
  renderWishlist();
  
  document.getElementById("searchBar").value = "";
  document.getElementById("searchSuggestions").classList.remove("active");
}

// ----------------------------------------------------
// 5. MANUAL ADD MEDIA CONTROLLERS
// ----------------------------------------------------
function openAddMediaModal() {
  document.getElementById("addMediaForm").reset();
  uploadedImageBase64 = "";
  
  document.getElementById("uploadPreview").style.display = "none";
  document.getElementById("uploadPreview").src = "";
  document.getElementById("uploadPlaceholder").style.display = "flex";
  
  document.getElementById("addMediaModal").classList.add("active");
}

function closeAddMediaModal() {
  document.getElementById("addMediaModal").classList.remove("active");
}

function triggerFileInput() {
  document.getElementById("addMediaFile").click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드할 수 있습니다.");
    return;
  }

  const placeholder = document.getElementById("uploadPlaceholder");
  placeholder.innerHTML = `<span>압축 중...</span>`;

  compressImage(file, function(compressedBase64) {
    uploadedImageBase64 = compressedBase64;
    
    const preview = document.getElementById("uploadPreview");
    preview.src = compressedBase64;
    preview.style.display = "block";
    
    placeholder.style.display = "none";
    document.getElementById("addMediaUrl").value = "";
  });
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      const max_width = 240;
      const scale = max_width / img.width;
      canvas.width = max_width;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      callback(dataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function handleUrlInput(e) {
  const url = e.target.value.trim();
  const preview = document.getElementById("uploadPreview");
  const placeholder = document.getElementById("uploadPlaceholder");

  if (url) {
    uploadedImageBase64 = "";
    document.getElementById("addMediaFile").value = "";
    
    preview.src = url;
    preview.style.display = "block";
    placeholder.style.display = "none";
  } else {
    preview.src = "";
    preview.style.display = "none";
    placeholder.style.display = "flex";
    placeholder.innerHTML = `
      <i data-lucide="image" style="width: 18px; height: 18px; margin-bottom: 2px;"></i>
      <span>미리보기</span>
    `;
    lucide.createIcons();
  }
}

function handleAddMediaSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById("addMediaTitle").value.trim();
  const type = document.querySelector('input[name="addMediaType"]:checked').value;
  const year = document.getElementById("addMediaYear").value.trim();
  const url = document.getElementById("addMediaUrl").value.trim();

  let poster = "";
  if (uploadedImageBase64) {
    poster = uploadedImageBase64;
  } else if (url) {
    poster = url;
  }

  const newMedia = {
    id: `media-${Date.now()}`,
    title,
    type,
    year: year ? year : "",
    poster
  };

  state.wishlist.unshift(newMedia);
  saveWishlistToStorage();
  renderWishlist();
  closeAddMediaModal();
}

// ----------------------------------------------------
// 6. CALENDAR LOG CONTROLLERS
// ----------------------------------------------------
function openLogModalFromWish(itemId) {
  const item = state.wishlist.find(w => w.id === itemId);
  if (!item) return;

  document.getElementById("logModalTitle").textContent = "시청기록 남기기";
  document.getElementById("logMediaId").value = item.id;
  document.getElementById("logMediaTitle").value = item.title;
  document.getElementById("logMediaType").value = item.type;
  document.getElementById("logMediaYear").value = item.year;
  document.getElementById("logMediaPoster").value = item.poster || "";
  document.getElementById("logEditId").value = "";

  document.getElementById("logDate").value = formatDate(new Date());
  setStarRating(5);
  document.getElementById("logReview").value = "";
  updateCharCount();

  document.getElementById("logModal").classList.add("active");
}

function openEditLogModal(logId) {
  const log = state.logs.find(l => l.id === logId);
  if (!log) return;

  document.getElementById("logModalTitle").textContent = "시청기록 수정";
  document.getElementById("logMediaId").value = log.contentId;
  document.getElementById("logMediaTitle").value = log.title;
  document.getElementById("logMediaType").value = log.type;
  document.getElementById("logMediaYear").value = log.year;
  document.getElementById("logMediaPoster").value = log.poster || "";
  document.getElementById("logEditId").value = log.id;

  document.getElementById("logDate").value = log.date;
  setStarRating(log.rating);
  document.getElementById("logReview").value = log.review;
  updateCharCount();

  document.getElementById("logModal").classList.add("active");
}

function closeLogModal() {
  document.getElementById("logModal").classList.remove("active");
}

function handleLogSubmit(e) {
  e.preventDefault();
  
  const contentId = document.getElementById("logMediaId").value;
  const title = document.getElementById("logMediaTitle").value;
  const type = document.getElementById("logMediaType").value;
  const year = document.getElementById("logMediaYear").value;
  const poster = document.getElementById("logMediaPoster").value;
  
  const editId = document.getElementById("logEditId").value;
  const date = document.getElementById("logDate").value;
  const rating = parseInt(document.getElementById("logRatingValue").value, 10);
  const review = document.getElementById("logReview").value.trim();

  if (editId) {
    const logIndex = state.logs.findIndex(l => l.id === editId);
    if (logIndex !== -1) {
      state.logs[logIndex].date = date;
      state.logs[logIndex].rating = rating;
      state.logs[logIndex].review = review;
    }
  } else {
    const newLog = {
      id: `log-${Date.now()}`,
      contentId,
      title,
      type,
      year,
      poster,
      date,
      rating,
      review
    };
    state.logs.push(newLog);
    state.wishlist = state.wishlist.filter(w => w.id !== contentId);
    saveWishlistToStorage();
  }

  saveLogsToStorage();
  closeLogModal();

  if (state.currentTab === "wishlistPage") {
    renderWishlist();
  } else {
    state.selectedDate = new Date(date);
    state.currentCalendarDate = new Date(date);
    renderCalendar();
    updateSelectedDayLogs();
  }
}

function deleteLog(id) {
  if (confirm("이 시청 기록을 삭제하시겠습니까?")) {
    state.logs = state.logs.filter(log => log.id !== id);
    saveLogsToStorage();
    renderCalendar();
    updateSelectedDayLogs();
  }
}

function setStarRating(rating) {
  document.getElementById("logRatingValue").value = rating;
  document.querySelectorAll("#starRatingInput .star-btn").forEach(btn => {
    const starNum = parseInt(btn.getAttribute("data-star"), 10);
    if (starNum <= rating) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function updateCharCount() {
  const reviewText = document.getElementById("logReview").value;
  document.getElementById("charCount").textContent = reviewText.length;
}

// ----------------------------------------------------
// 7. SETTINGS & UTILITIES (DATA MANAGEMENT)
// ----------------------------------------------------
document.getElementById("btnOpenSettings").addEventListener("click", () => {
  document.getElementById("settingsModal").classList.add("active");
});

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("active");
}

function resetAllData() {
  if (confirm("🚨 주의: 모든 찜 목록과 시청 기록이 영구히 삭제됩니다. 정말 삭제하시겠습니까?")) {
    localStorage.removeItem("cinelog_wishlist");
    localStorage.removeItem("cinelog_logs");
    state.wishlist = [];
    state.logs = [];
    
    renderWishlist();
    renderCalendar();
    updateSelectedDayLogs();
    closeSettingsModal();
    alert("데이터가 초기화되었습니다.");
  }
}

function loadSampleData() {
  if (confirm("기존 데이터에 샘플 데이터를 추가로 불러오시겠습니까?")) {
    preloadDefaultSampleData(true);
    closeSettingsModal();
    alert("샘플 데이터를 성공적으로 불러왔습니다.");
  }
}

// Sample Data Setup
function preloadDefaultSampleData(append = false) {
  const todayStr = formatDate(new Date());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  const sampleWishlist = [
    { id: "sample-w-1", title: "인셉션 (Inception)", type: "movie", year: "2010", poster: "https://image.tmdb.org/t/p/w300/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg" },
    { id: "sample-w-2", title: "기묘한 이야기 (Stranger Things)", type: "tv", year: "2016", poster: "https://image.tmdb.org/t/p/w300/49WJfeN0moxb9IPfGn8AIqMGskD.jpg" }
  ];

  const sampleLogs = [
    {
      id: `sample-l-${Date.now()}-1`,
      contentId: "sample-c-1",
      title: "인터스텔라 (Interstellar)",
      type: "movie",
      year: "2014",
      poster: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      date: todayStr,
      rating: 5,
      review: "우주 과학과 가족애가 만들어낸 최고의 걸작. 영화관에서 보지 못한 게 평생 한이네요."
    },
    {
      id: `sample-l-${Date.now()}-2`,
      contentId: "sample-c-2",
      title: "러브레터 (Love Letter)",
      type: "movie",
      year: "1995",
      poster: "https://image.tmdb.org/t/p/w300/fW6R65UaH14F6jV2Tpx7XgD65uG.jpg",
      date: yesterdayStr,
      rating: 4,
      review: "오랜만에 다시 봐도 눈물 펑펑 쏟아지는 겨울 최고의 멜로. 오겡끼데스까!"
    }
  ];

  if (append) {
    state.wishlist = [...sampleWishlist, ...state.wishlist];
    state.logs = [...sampleLogs, ...state.logs];
  } else {
    state.wishlist = sampleWishlist;
    state.logs = sampleLogs;
  }

  saveWishlistToStorage();
  saveLogsToStorage();
  
  renderWishlist();
  renderCalendar();
  updateSelectedDayLogs();
}

// ----------------------------------------------------
// 8. EVENT LISTENERS & BOOTSTRAP
// ----------------------------------------------------
function setupEventListeners() {
  document.getElementById("btnLogo").addEventListener("click", () => {
    switchTab("wishlistPage");
  });

  document.querySelectorAll(".nav-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  document.getElementById("searchBar").addEventListener("keyup", (e) => {
    const query = e.target.value;
    clearTimeout(state.searchDebounceTimer);
    
    state.searchDebounceTimer = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  document.addEventListener("click", (e) => {
    const searchContainer = document.querySelector(".search-container");
    if (searchContainer && !searchContainer.contains(e.target)) {
      document.getElementById("searchSuggestions").classList.remove("active");
    }
  });

  document.querySelectorAll("#starRatingInput .star-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const rating = parseInt(btn.getAttribute("data-star"), 10);
      setStarRating(rating);
    });
  });

  document.getElementById("btnPrevMonth").addEventListener("click", () => {
    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("btnNextMonth").addEventListener("click", () => {
    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
    renderCalendar();
  });
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener("DOMContentLoaded", initApp);
