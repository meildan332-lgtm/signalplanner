// 1. 파이어베이스 초기화 및 Firestore 불러오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBKHLfymzRWRqUEsX9MF_SlZoph1WM_4Ck",
    authDomain: "signalplanner-95f78.firebaseapp.com",
    projectId: "signalplanner-95f78",
    storageBucket: "signalplanner-95f78.firebasestorage.app",
    messagingSenderId: "859229037333",
    appId: "1:859229037333:web:30eb50897b017c33b13f1c",
    measurementId: "G-D1RQRFH1KF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. 상태 관리 전역 변수
let scheduleList = []; 
let memoData = {}; 
let isAdmin = false;
let loggedInUser = null; 
let currentPage = '홈';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let pickerYear = currentYear;
let contextTargetId = null;
let currentEditingIds = [];
let targetModalContext = { year: currentYear, month: currentMonth, day: 1, member: '홈' };

const themeColors = { '홈': '#FF5252', '달타': '#FBC02D', '서피카': '#F06292', '다룽': '#1E88E5', '최또': '#D81B60', '카나시': '#F57C00' };

const collectionMap = {
    '달타': 'daltaevent',
    '서피카': 'SEOPICAevent',
    '다룽': 'drungevent',
    '최또': 'choiagainevent',
    '카나시': 'kanashievent'
};

const memoCollectionMap = {
    '달타': 'daltamemo',
    '서피카': 'seopicamemo',
    '다룽': 'drungmemo',
    '최또': 'choiagainmemo',
    '카나시': 'kanashimemo'
};

// ★ 네이버 로그인 이메일 기준 관리자 목록 (여기에 실제 네이버 이메일을 입력하세요)
const adminAccounts = {
    'admin1@naver.com': { name: '달타', img: 'https://stimg.sooplive.com/LOGO/da/dalta20/dalta20.jpg' },
    'admin2@naver.com': { name: '서피카', img: 'https://stimg.sooplive.com/LOGO/sp/spica21/spica21.jpg' }
    // ... 나머지 멤버들의 네이버 이메일 추가
};

// 기존 비밀번호 목록 (네이버 아이디가 없는 경우를 위한 대비책)
const adminPasswords = {
    '0820': { name: '달타', img: 'https://stimg.sooplive.com/LOGO/da/dalta20/dalta20.jpg' },
    '0221': { name: '서피카', img: 'https://stimg.sooplive.com/LOGO/sp/spica21/spica21.jpg' },
    '1128': { name: '다룽', img: 'https://stimg.sooplive.com/LOGO/da/daarung22/daarung22jpg' },
    '1030': { name: '최또', img: 'https://stimg.sooplive.com/LOGO/ch/choiagain/choiagain.jpg' },
    '0123': { name: '카나시', img: 'https://stimg.sooplive.com/LOGO/kj/kjhh0029/kjhh0029.jpg' }
};

// ★ 네이버 로그인 초기화 설정
const naverLogin = new naver.LoginWithNaverId({
    clientId: "an6qp9jysDqzS6UnwJZy", // 회원님이 주신 Client ID 적용!
    // 테스트하시는 로컬 주소나 실제 웹 주소로 반드시 변경해주세요 (예: http://127.0.0.1:5500)
    callbackUrl: "https://signalcalendar.netlify.app/#", 
    isPopup: false, 
    loginButton: { color: "green", type: 3, height: 48 }
});

// 초기화 실행
naverLogin.init();

// 페이지 로드 시 네이버 로그인 상태 확인 및 콜백 처리
window.addEventListener('load', function () {
    naverLogin.getLoginStatus(function (status) {
        if (status) {
            // 로그인 성공 시 사용자 이메일 가져오기
            const userEmail = naverLogin.user.getEmail();
            
            // 관리자 계정인지 확인
            if (adminAccounts[userEmail]) {
                isAdmin = true;
                loggedInUser = adminAccounts[userEmail];
                
                const adminBtn = document.getElementById('adminMenuBtn');
                if (adminBtn) {
                    adminBtn.innerHTML = `
                        <div class="flex items-center gap-2">
                            <img src="${loggedInUser.img || 'https://via.placeholder.com/40'}" class="w-9 h-9 rounded-full object-cover border-2 border-[#5D4037]">
                            <span class="text-lg">${loggedInUser.name}</span>
                        </div>
                    `;
                }
                closePasswordModal();
            } else {
                alert("관리자 권한이 없는 계정입니다.");
                naverLogin.logout(); // 권한 없으면 강제 로그아웃
            }
        }
    });
});

// 3. 파이어베이스 연동 함수들

async function loadSchedulesFromFirebase() {
    render(); 
    try {
        const eventPromises = Object.entries(collectionMap).map(([member, colName]) => {
            return getDocs(collection(db, colName)).then(snapshot => ({ type: 'event', member, colName, snapshot }));
        });

        const memoPromises = Object.entries(memoCollectionMap).map(([member, colName]) => {
            return getDocs(collection(db, colName)).then(snapshot => ({ type: 'memo', member, colName, snapshot }));
        });
        
        const results = await Promise.all([...eventPromises, ...memoPromises]);
        scheduleList = []; 
        memoData = {}; 
        
        results.forEach(({ type, member, colName, snapshot }) => {
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (type === 'memo') {
                    const key = member;
                    memoData[key] = { id: doc.id, collectionName: colName, content: data.content };
                } else {
                    scheduleList.push({ id: doc.id, collectionName: colName, ...data });
                }
            });
        });
        
        render();
    } catch (e) {
        console.error("데이터 불러오기 실패:", e);
    }
}

async function deleteFromMenu() {
    if(!contextTargetId) return;
    if (confirm('해당 일정을 삭제하시겠습니까?')) {
        const sch = scheduleList.find(s => s.id === contextTargetId);
        if(!sch) return;
        
        try {
            await deleteDoc(doc(db, sch.collectionName, contextTargetId));
            scheduleList = scheduleList.filter(s => s.id !== contextTargetId); 
            render();
        } catch(e) {
            console.error("삭제 실패:", e);
        }
    }
}

async function saveSchedule() {
    const globalType = document.querySelector('input[name="globalSchType"]:checked').value;
    const isHubang = globalType === '휴방';
    const memberTab = targetModalContext.member;
    
    const colName = collectionMap[memberTab];
    if(!colName) {
        alert("저장할 멤버 정보가 올바르지 않습니다.");
        return;
    }

    for (let oldId of currentEditingIds) {
        const oldSch = scheduleList.find(s => s.id === oldId);
        if (oldSch) {
            try { await deleteDoc(doc(db, oldSch.collectionName, oldId)); } catch(e) {}
        }
    }
    scheduleList = scheduleList.filter(s => !currentEditingIds.includes(s.id));

    const blocks = document.querySelectorAll('#scheduleInputsContainer .schedule-input-block');
    for (const block of blocks) {
        const title = block.querySelector('.sch-title').value.trim();
        if (title) { 
            const sDate = block.querySelector('.sch-start').value;
            const eDate = block.querySelector('.sch-end').value;
            const ampm = block.querySelector('.sch-ampm').innerText;
            const hh = block.querySelector('.sch-hh').value;
            const mm = block.querySelector('.sch-mm').value;
            const broad = isHubang ? '' : block.querySelector('.sch-broad').value;
            const mem = isHubang ? '' : block.querySelector('.sch-mem').value.trim();
            const timeStr = isHubang ? '' : buildTimeStr(ampm, hh, mm);
            const desc = block.querySelector('.sch-desc').value.trim();
            
            const newSchedule = { 
                tabOrMember: memberTab, globalType, title, startDate: sDate, endDate: eDate,
                time: timeStr, broadType: broad, memberTag: mem, detail: desc
            };
            
            try {
                const docRef = await addDoc(collection(db, colName), newSchedule);
                newSchedule.id = docRef.id;
                newSchedule.collectionName = colName; 
                scheduleList.push(newSchedule);
            } catch(e) {
                console.error("저장 오류:", e);
            }
        }
    }
    closeScheduleModal(); 
    render();
}

async function saveEditedSchedule() {
    if(!contextTargetId) return;
    const block = document.getElementById('editContainer').querySelector('.schedule-input-block');
    const title = block.querySelector('.sch-title').value.trim();
    if(!title) { alert("일정 제목을 입력해주세요."); return; }

    const globalType = document.querySelector('input[name="editGlobalSchType"]:checked').value;
    const isHubang = globalType === '휴방';
    const sDate = block.querySelector('.sch-start').value;
    const eDate = block.querySelector('.sch-end').value;
    const ampm = block.querySelector('.sch-ampm').innerText;
    const hh = block.querySelector('.sch-hh').value;
    const mm = block.querySelector('.sch-mm').value;
    const broad = isHubang ? '' : block.querySelector('.sch-broad').value;
    const mem = isHubang ? '' : block.querySelector('.sch-mem').value.trim();
    const timeStr = isHubang ? '' : buildTimeStr(ampm, hh, mm);
    const desc = block.querySelector('.sch-desc').value.trim();

    const updatedData = { globalType, title, startDate: sDate, endDate: eDate, time: timeStr, broadType: broad, memberTag: mem, detail: desc };

    const sch = scheduleList.find(s => s.id === contextTargetId);
    if(!sch) return;

    try {
        await updateDoc(doc(db, sch.collectionName, contextTargetId), updatedData);
        
        const idx = scheduleList.findIndex(s => s.id === contextTargetId);
        if(idx !== -1) {
            scheduleList[idx] = { ...scheduleList[idx], ...updatedData };
        }
        closeEditModal(); 
        render();
    } catch(e) {
        console.error("수정 오류:", e);
    }
}

// ★ 메모 패널 열고 닫기 (창 닫을 때 저장)
function toggleMemoPanel() {
    const panel = document.getElementById('memoPanel');
    const title = document.getElementById('memoPanelTitle');
    const textarea = document.getElementById('memoTextarea');
    
    if (panel.classList.contains('translate-x-full')) {
        // 메모창 열기
        const key = currentPage; 
        
        title.innerText = `${currentPage} 메모장`;
        textarea.value = memoData[key] ? memoData[key].content : '';
        
        textarea.placeholder = ""; 
        
        if (isAdmin) {
            textarea.readOnly = false;
        } else {
            textarea.readOnly = true;
        }

        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0'); 
    } else {
        // 메모창 닫기
        if (isAdmin) {
            saveMemo(); // 닫힐 때 백그라운드 자동 저장
        }
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
    }
}

async function saveMemo() {
    if (!isAdmin) return;
    
    const text = document.getElementById('memoTextarea').value;
    const colName = memoCollectionMap[currentPage]; 
    
    if (!colName) return;

    const key = currentPage;

    try {
        if (memoData[key] && memoData[key].id) {
            await updateDoc(doc(db, colName, memoData[key].id), { content: text });
            memoData[key].content = text;
        } else {
            const docRef = await addDoc(collection(db, colName), { content: text });
            memoData[key] = { id: docRef.id, collectionName: colName, content: text };
        }
        console.log('메모 자동 저장 완료');
    } catch(e) {
        console.error("메모 저장 실패:", e);
    }
}

// 4. 일반 유틸 및 렌더링 함수들

function formatTime12(timeStr) {
    if (!timeStr) return '';
    const [hourStr, minute] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? '오후' : '오전';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${ampm} ${hour}:${minute}`;
}

function buildTimeStr(ampm, hh, mm) {
    if (!hh) return '';
    let h = parseInt(hh, 10);
    let m = mm ? parseInt(mm, 10) : 0;
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function toggleAmpm(btn) { btn.innerText = btn.innerText === '오후' ? '오전' : '오후'; }

function isDateStrInRange(targetDateStr, startStr, endStr) {
    const t = new Date(targetDateStr).setHours(0,0,0,0);
    const s = new Date(startStr).setHours(0,0,0,0);
    const e = new Date(endStr).setHours(0,0,0,0);
    return t >= s && t <= e;
}

function toggleFields(modalId, radioName) {
    const modal = document.getElementById(modalId);
    if(!modal) return;
    const radio = modal.querySelector(`input[name="${radioName}"]:checked`);
    if (!radio) return;
    const isHubang = radio.value === '휴방';
    modal.querySelectorAll('.optional-field').forEach(el => { el.style.display = isHubang ? 'none' : ''; });
}

function toggleMenu() {
    const menu = document.getElementById('dropdownMenu');
    if (menu.classList.contains('hidden')) {
        menu.classList.replace('hidden', 'flex');
    } else {
        menu.classList.replace('flex', 'hidden');
    }
}

function handleAdminClick() {
    if (isAdmin) {
        if (confirm(`${loggedInUser.name}님 로그아웃 하시겠습니까?`)) {
            logoutAdmin();
        }
    } else {
        openPasswordModal();
    }
}

function checkPassword() {
    const val = document.getElementById('pwInput').value;
    const user = adminPasswords[val]; 

    if (user) {
        isAdmin = true;
        loggedInUser = user;
        
        const adminBtn = document.getElementById('adminMenuBtn');
        if (adminBtn) {
            adminBtn.innerHTML = `
                <div class="flex items-center gap-2">
                    <img src="${user.img || 'https://via.placeholder.com/40'}" class="w-9 h-9 rounded-full object-cover border-2 border-[#5D4037]">
                    <span class="text-lg">${user.name}</span>
                </div>
            `;
        }
        
        alert(`${user.name}님 환영합니다!`);
        document.getElementById('pwInput').value = '';
        closePasswordModal();
    } else {
        alert('비밀번호가 틀렸습니다.');
        document.getElementById('pwInput').value = '';
    }
}

// ★ 네이버 로그아웃 로직 추가
function logoutAdmin() {
    isAdmin = false;
    loggedInUser = null;
    const adminBtn = document.getElementById('adminMenuBtn');
    if (adminBtn) {
        adminBtn.innerHTML = '로그인';
    }
    
    const panel = document.getElementById('memoPanel');
    if(panel && !panel.classList.contains('translate-x-full')) {
        toggleMemoPanel();
    }

    // 네이버 인증 토큰 로컬 스토리지에서 삭제
    localStorage.removeItem('com.naver.nid.access_token');
    localStorage.removeItem('com.naver.nid.oauth.state_token');

    alert('로그아웃 되었습니다.');
    window.location.reload(); // 캐시 및 세션 초기화를 위해 새로고침
}

function openPasswordModal() { document.getElementById('passwordModal').classList.replace('hidden', 'flex'); }
function closePasswordModal() { document.getElementById('passwordModal').classList.replace('flex', 'hidden'); }
function closeLogoutModal() { document.getElementById('logoutModal').classList.replace('flex', 'hidden'); }

function handleDayClick(year, month, day, member) {
    if (!isAdmin) return;
    openScheduleModal(year, month, day, member);
}

function showContextMenu(event, schId) {
    if (!isAdmin) return;
    event.preventDefault(); event.stopPropagation(); contextTargetId = schId;
    const menu = document.getElementById('contextMenu');
    menu.style.left = event.clientX + 'px'; menu.style.top = event.clientY + 'px';
    menu.classList.remove('hidden'); menu.classList.add('flex');
}

window.addEventListener('click', (e) => {
    const dropMenu = document.getElementById('dropdownMenu');
    const dropBtn = document.getElementById('menuToggleBtn');
    if (dropMenu && !dropMenu.classList.contains('hidden')) {
        const isClickInsideBtn = dropBtn && (e.target === dropBtn || dropBtn.contains(e.target));
        const isClickInsideMenu = dropMenu.contains(e.target);
        
        if (!isClickInsideBtn && !isClickInsideMenu) {
            dropMenu.classList.replace('flex', 'hidden');
        }
    }

    const cMenu = document.getElementById('contextMenu');
    if (cMenu && !cMenu.classList.contains('hidden')) {
        cMenu.classList.add('hidden'); cMenu.classList.remove('flex');
    }
});

function getScheduleFormHTML(data, isDeletable = true) {
    const id = data.id || '';
    const title = data.title || '';
    const sDate = data.startDate || '';
    const eDate = data.endDate || '';
    const broad = data.broadType || '개인방송';
    const mem = data.memberTag || '';
    const desc = data.detail || '';
    let hh = '', mm = '', ampm = '오후';
    if (data.time) {
        let [h, m] = data.time.split(':'); h = parseInt(h, 10);
        ampm = h >= 12 ? '오후' : '오전'; h = h % 12; if (h === 0) h = 12; hh = h; mm = m;
    }

    const deleteBtnHtml = isDeletable ? `<button class="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full font-bold flex items-center justify-center shadow-md border-2 border-white hover:bg-red-600 transition-all z-10" onclick="this.closest('.schedule-input-block').remove()" title="일정 삭제"><i class="fi fi-sr-minus-small"></i></button>` : '';

    return `
        <div class="schedule-input-block border-2 border-[#5D4037] p-5 rounded-xl bg-white relative shadow-sm pretendard mt-1">
            ${deleteBtnHtml}
            <input type="hidden" class="sch-id" value="${id}">
            <div class="mb-4 pr-8">
                <label class="block text-[13px] text-gray-500 font-bold mb-1.5">일정 제목</label>
                <input type="text" class="sch-title w-full border-2 border-[#5D4037] rounded-lg p-2.5 outline-none focus:border-[var(--theme-color)] text-[15px] font-medium" placeholder="일정 제목 입력" value="${title}">
            </div>
            <div class="mb-4">
                <label class="block text-[13px] text-gray-500 font-bold mb-1.5">날짜</label>
                <div class="flex items-center gap-2">
                    <input type="date" class="sch-start flex-1 border-2 border-[#5D4037] rounded-lg p-2 outline-none text-[14px] font-medium" value="${sDate}">
                    <span class="font-bold text-[#5D4037]">~</span>
                    <input type="date" class="sch-end flex-1 border-2 border-[#5D4037] rounded-lg p-2 outline-none text-[14px] font-medium" value="${eDate}">
                </div>
            </div>
            <div class="flex gap-4 mb-4 optional-field">
                <div class="flex-1">
                    <label class="block text-[13px] text-gray-500 font-bold mb-1.5">시간</label>
                    <div class="flex items-center justify-between border-2 border-[#5D4037] rounded-lg p-1.5 bg-white">
                        <button type="button" class="sch-ampm ampm-btn px-2.5 py-1 font-bold text-[#5D4037] rounded-md text-[13px]" onclick="toggleAmpm(this)">${ampm}</button>
                        <input type="number" min="1" max="12" class="sch-hh w-[38px] p-1 text-center font-bold text-[#5D4037] outline-none text-[15px]" placeholder="시" value="${hh}">
                        <span class="font-bold text-[#5D4037]">:</span>
                        <input type="number" min="0" max="59" class="sch-mm w-[38px] p-1 text-center font-bold text-[#5D4037] outline-none mr-1 text-[15px]" placeholder="분" value="${mm}">
                    </div>
                </div>
                <div class="flex-1">
                    <label class="block text-[13px] text-gray-500 font-bold mb-1.5">유형</label>
                    <select class="sch-broad w-full border-2 border-[#5D4037] rounded-lg p-2.5 outline-none text-[15px] bg-white font-bold text-[#5D4037] cursor-pointer">
                        <option value="개인방송" ${broad==='개인방송'?'selected':''}>개인방송</option>
                        <option value="합방" ${broad==='합방'?'selected':''}>합방</option>
                        <option value="시네티" ${broad==='시네티'?'selected':''}>시네티</option>
                    </select>
                </div>
            </div>
            <div class="mb-4 optional-field">
                <label class="block text-[13px] text-gray-500 font-bold mb-1.5">멤버</label>
                <input type="text" class="sch-mem w-full border-2 border-[#5D4037] rounded-lg p-2.5 outline-none focus:border-[var(--theme-color)] text-[15px] font-medium" placeholder="멤버 태그 입력 (선택)" value="${mem}">
            </div>
            <div>
                <label class="block text-[13px] text-gray-500 font-bold mb-1.5">상세</label>
                <textarea class="sch-desc w-full border-2 border-[#5D4037] rounded-lg p-3 outline-none focus:border-[var(--theme-color)] text-[15px] resize-none h-[75px] font-medium" placeholder="상세 내용을 입력하세요 (선택)">${desc}</textarea>
            </div>
        </div>
    `;
}

function openScheduleModal(year, month, day, member) {
    targetModalContext = { year, month, day, member };
    document.getElementById('scheduleModalDate').innerText = `${year}년 ${month}월 ${day}일`;
    
    const targetDateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const targets = scheduleList.filter(s => s.tabOrMember === member && isDateStrInRange(targetDateStr, s.startDate, s.endDate));
    currentEditingIds = targets.map(t => t.id);

    const container = document.getElementById('scheduleInputsContainer'); container.innerHTML = '';
    
    if (targets.length > 0) {
        document.querySelector(`input[name="globalSchType"][value="${targets[0].globalType}"]`).checked = true;
        targets.forEach(t => container.insertAdjacentHTML('beforeend', getScheduleFormHTML(t, true)));
    } else {
        document.querySelector('input[name="globalSchType"][value="뱅온"]').checked = true;
        container.insertAdjacentHTML('beforeend', getScheduleFormHTML({ startDate: targetDateStr, endDate: targetDateStr }, true));
    }
    
    document.getElementById('scheduleModal').classList.replace('hidden', 'flex');
    toggleFields('scheduleModal', 'globalSchType');
}

function addScheduleInputBlock() {
    const { year, month, day } = targetModalContext;
    const targetDateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const container = document.getElementById('scheduleInputsContainer');
    container.insertAdjacentHTML('beforeend', getScheduleFormHTML({ startDate: targetDateStr, endDate: targetDateStr }, true));
    container.scrollTop = container.scrollHeight;
    toggleFields('scheduleModal', 'globalSchType');
}

function closeScheduleModal() { document.getElementById('scheduleModal').classList.replace('flex', 'hidden'); }

function editFromMenu() {
    if(!contextTargetId) return;
    const sch = scheduleList.find(s => s.id === contextTargetId);
    if(!sch) return;

    document.querySelector(`input[name="editGlobalSchType"][value="${sch.globalType}"]`).checked = true;
    document.getElementById('editContainer').innerHTML = getScheduleFormHTML(sch, false);
    document.getElementById('editScheduleModal').classList.replace('hidden', 'flex');
    toggleFields('editScheduleModal', 'editGlobalSchType');
}

function closeEditModal() { document.getElementById('editScheduleModal').classList.replace('flex', 'hidden'); contextTargetId = null; }

function renderSchedulesInModal(schedules) {
    const modal = document.getElementById('scheduleDetailModal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.style.width = '450px';
    modalContent.style.backgroundColor = '#FFFDF5';
    
    modalContent.style.padding = '12px 20px 20px 20px';

    const closeBtnContainer = modal.querySelector('.justify-end.mb-2');
    if (closeBtnContainer) {
        closeBtnContainer.style.marginBottom = '0px';
    }

    let htmlContent = '<div class="flex flex-col w-full max-h-[65vh] overflow-y-auto px-2 pt-2 pb-4 modal-scroll">';
    
    schedules.forEach((sch, index) => {
        let timeText = sch.time ? formatTime12(sch.time) : '';
        let broadText = sch.broadType || '개인방송';
        let memText = sch.memberTag || '';
        let detailText = sch.detail || '';
        
        let badgeHtml = sch.globalType === '휴방' 
            ? ''
            : `<div class="flex gap-2 justify-center">
                ${timeText ? `<span class="px-4 py-1.5 bg-[#5D4037] text-white text-[13px] font-bold rounded-full shadow-sm">${timeText}</span>` : ''}
                <span class="px-4 py-1.5 bg-[#5D4037] text-white text-[13px] font-bold rounded-full shadow-sm">${broadText}</span>
               </div>`;

        htmlContent += `
            <div class="flex flex-col w-full items-center">
                <div class="flex flex-col items-center gap-2 mb-4 w-full">
                    <div class="text-[28px] font-bold text-[#000] text-center leading-tight break-keep font-omudaye">${sch.title}</div>
                    ${badgeHtml}
                </div>
                
                <div class="flex flex-col gap-5 w-full pretendard px-3">
                    ${memText ? `
                    <div class="flex flex-col">
                        <div class="text-[13px] text-gray-400 font-bold mb-1">멤버</div>
                        <div class="text-[17px] text-[#5D4037] font-bold">${memText}</div>
                    </div>` : ''}
                    
                    ${detailText ? `
                    <div class="flex flex-col">
                        <div class="text-[13px] text-gray-400 font-bold mb-1">상세</div>
                        <div class="text-[15px] text-[#5D4037] font-medium leading-relaxed whitespace-pre-wrap">${detailText}</div>
                    </div>` : ''}
                </div>
            </div>        `;
        
        if (index < schedules.length - 1) {
            htmlContent += `<div class="w-full border-b-2 border-dashed border-[#5D4037] opacity-20 my-8"></div>`;
        }
    });
    
    htmlContent += '</div>';

    document.getElementById('detailDesc').innerHTML = htmlContent;

    const closeBtn = modal.querySelector('.modal-btn');
    if(closeBtn) {
        closeBtn.className = "modal-btn w-full bg-[#5D4037] text-white py-4 rounded-2xl font-bold text-[20px] mt-6 hover:brightness-110 transition-all cursor-pointer";
        closeBtn.innerText = "닫기";
    }

    modal.classList.replace('hidden', 'flex');
    modal.style.display = '';
}

function openDetailModal(event, schId) {
    event.stopPropagation();
    const sch = scheduleList.find(s => s.id === schId);
    if(!sch) return;
    renderSchedulesInModal([sch]);
}

function openAllSchedulesModal(event, dateStr, member) {
    event.stopPropagation();
    const [y, m, d] = dateStr.split('-');
    const targetDateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    
    const allSchedules = scheduleList.filter(s => 
        s.tabOrMember === member && isDateStrInRange(targetDateStr, s.startDate, s.endDate)
    );
    renderSchedulesInModal(allSchedules);
}

function closeDetailModal() {
    const modal = document.getElementById('scheduleDetailModal');
    modal.classList.replace('flex', 'hidden');
    modal.style.display = ''; 
}

function changeTab(tabName) { currentPage = tabName; render(); }
function changeMonth(delta) { currentMonth += delta; if (currentMonth > 12) { currentMonth = 1; currentYear++; } else if (currentMonth < 1) { currentMonth = 12; currentYear--; } render(); }
function openMonthPicker() { pickerYear = currentYear; renderPicker(); document.getElementById('monthPickerModal').classList.replace('hidden', 'flex'); }
function closeMonthPicker() { document.getElementById('monthPickerModal').classList.replace('flex', 'hidden'); }
function changePickerYear(delta) { pickerYear += delta; renderPicker(); }
function selectMonth(m) { currentYear = pickerYear; currentMonth = m; closeMonthPicker(); render(); }
function renderPicker() {
    document.getElementById('pickerYearText').innerText = `${pickerYear}년`;
    const grid = document.getElementById('pickerMonthGrid'); grid.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button'); btn.innerText = `${i}월`;
        btn.className = (pickerYear === currentYear && i === currentMonth) ? 'month-btn active py-3.5 rounded-lg font-bold text-[20px]' : 'month-btn py-3.5 rounded-lg font-bold text-[20px]';
        btn.onclick = () => selectMonth(i); grid.appendChild(btn);
    }
}

function buildScheduleCardHtml(sch, isWeekly = false) {
    const color = sch.globalType === '휴방' ? '#9CA3AF' : 'var(--theme-color)';
    const bgColor = sch.globalType === '휴방' ? '#F9FAFB' : '#FFF5F5';
    const formattedTime = formatTime12(sch.time) || '';
    const broadType = sch.broadType || '';

    // font-size: 19px 유지
    return `
        <div class="schedule-card ${sch.globalType === '휴방' ? 'hubang' : 'bangon'}" 
             style="color: ${color}; background-color: ${bgColor}; padding: 4px;" 
             onclick="openDetailModal(event, '${sch.id}')" 
             oncontextmenu="showContextMenu(event, '${sch.id}')">
             
             <div class="w-full flex justify-between items-center px-1 mb-1" style="font-size: 19px; font-weight: 700;">
                <span>${broadType}</span>
                <span>${formattedTime}</span>
             </div>
             
             <div class="flex-1 flex items-center justify-center w-full px-1">
                <span class="schedule-text font-OmuDaye">${sch.title}</span>
            </div>
        </div>
    `;
}

function render() {
    // 🔥 월간 캘린더 화면일 때 바디 배경색을 캘린더색상보다 더 연한 톤으로 변경
    const tabBackgrounds = { 
        '홈': '#ffdddd',   // 홈 기본 배경색 (기존 HTML과 동일)
        '달타': '#FFFDE7', // 달타 월간 캘린더(#FFF9C4)보다 연한 톤
        '서피카': '#FFF5F9', // 서피카 월간 캘린더(#FFDEE9)보다 연한 톤
        '다룽': '#E3F2FD', // 다룽 월간 캘린더(#BBDEFB)보다 연한 톤
        '최또': '#FCE4EC', // 최또 월간 캘린더(#F8BBD0)보다 연한 톤
        '카나시': '#FFF3E0'  // 카나시 월간 캘린더(#FFE0B2)보다 연한 톤
    };

    // HTML의 Tailwind 클래스(bg-[#ffdddd])보다 우선순위를 높이기 위해 JS에서 직접 body의 배경색을 변경합니다.
    document.body.style.backgroundColor = tabBackgrounds[currentPage] || '#ffdddd';
    document.documentElement.style.setProperty('--theme-color', themeColors[currentPage]);
    
    const content = document.getElementById('mainContent'); 
    if(!content) return;
    
    content.innerHTML = '';
    
    const logoImgUrl = "https://i.namu.wiki/i/TJgdKNl8C9pH3EUWbPBNXf8x8nqSfvHC6s7RFIrJpa1q5ZfF5C-ZSZAfVwkc2Cg7fEL3g-_BDyVu0_jnM64v3tzxwaxRpbY0mGi5IqnLninFRLDRo8saqkm7t6dCsymt77vsMQpCs8--nkcxqxADOg.webp";

    const grouped = {};
    scheduleList.forEach(sch => {
        if(!sch.startDate || !sch.endDate) return;
        let start = new Date(sch.startDate); let end = new Date(sch.endDate);
        start.setHours(0,0,0,0); end.setHours(0,0,0,0);
        for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${sch.tabOrMember}`;
            if(!grouped[key]) grouped[key] = [];
            grouped[key].push(sch);
        }
    });
    
    const realToday = new Date();

    if (currentPage === '홈') {
        const today = new Date(); const diff = today.getDay() === 0 ? -6 : 1 - today.getDay();
        const monday = new Date(today); monday.setDate(today.getDate() + diff);
        const weekDates = Array.from({length: 7}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
        const daysLabel = ['월', '화', '수', '목', '금', '토', '일'];
        
        const headerHtml = weekDates.map((d, i) => {
            let c = ''; if (i === 5) c = 'text-blue-600'; if (i === 6) c = 'text-red-600';
            const isToday = d.getFullYear() === realToday.getFullYear() && d.getMonth() === realToday.getMonth() && d.getDate() === realToday.getDate();
            const dateStr = `${d.getMonth() + 1}.${d.getDate()}`;
            const displayDate = isToday ? `<span class="bg-[#5D4037] text-white px-2 py-0.5 rounded-md">${dateStr}</span>` : dateStr;
            return `<div class="header-days-cell ${c}"><div class="leading-none mb-1">${daysLabel[i]}</div><div class="text-[14px] text-gray-500 font-bold font-paperozi">${displayDate}</div></div>`;
        }).join('');

        const rowBgColors = ['#FFFDE7', '#FFF5F9', '#E3F2FD', '#FFF0F5', '#FFF3E0'];
        const rowBorderColors = ['#FBC02D', '#F06292', '#1E88E5', '#D81B60', '#F57C00'];
        const members = [
            { name: '달타', img: 'https://i.postimg.cc/28by98rm/7418691211bd4b5c5.png', link: 'https://www.sooplive.com/station/dalta20' },
            { name: '서피카', img: 'https://i.postimg.cc/15nX75sm/4819691211c6caa92.png', link: '' },
            { name: '다룽', img: 'https://i.postimg.cc/qMhqDM44/9959691211c22a854.png', link: '' },
            { name: '최또', img: 'https://i.postimg.cc/vHgT2HbG/7217691211aa8e846.png', link: '' },
            { name: '카나시', img: 'https://i.postimg.cc/Gh8tghd9/2661691211ca0e69c.png', link: '' }
        ];

        let homeHtml = `<div class="home-white-box"><div class="mb-8 w-full"><div class="flex gap-[22px] justify-center items-end"><div class="w-[277px] flex items-center justify-center pb-2"><img src="${logoImgUrl}" alt="SIGNAL Logo" style="height: 110px; object-fit: contain; transition: transform 0.2s;" class="cursor-pointer hover:scale-105" onclick="changeTab('홈')"></div><div class="header-days-container">${headerHtml}</div></div></div><div class="weekly-grid">`;

        members.forEach((member, i) => {
            let daysCellsHtml = '';
            weekDates.forEach(d => {
                const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${member.name}`;
                const daySchedules = grouped[key] || [];
                let schedulesHtml = '';

                if (daySchedules.length > 0) {
                    const isHubang = daySchedules.some(s => s.globalType === '휴방');
                    const label = isHubang ? '휴방' : '뱅온';
                    const borderColor = isHubang ? '#9CA3AF' : rowBorderColors[i];
                    const bgColor = isHubang ? '#F3F4F6' : rowBgColors[i];
                    
                    schedulesHtml = `
                        <div class="schedule-card" 
                             style="color: ${borderColor}; background-color: ${bgColor};" 
                             onclick="openAllSchedulesModal(event, '${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}', '${member.name}')">
                            <span class="text-[45px] font-bold">${label}</span>
                        </div>
                    `;
                }
                
                daysCellsHtml += `<div class="day-cell" onclick="handleDayClick(${d.getFullYear()}, ${d.getMonth()+1}, ${d.getDate()}, '${member.name}')"><div class="schedule-list w-full h-full">${schedulesHtml}</div></div>`;
            });
            homeHtml += `<div class="week-row row-${i+1}"><div class="profile-cell" ${member.link ? `onclick="window.open('${member.link}', '_blank')"` : ''}><img src="${member.img}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover;"></div><div class="days-container">${daysCellsHtml}</div></div>`;
        });
        content.innerHTML = homeHtml + `</div></div>`;
    } else {
        const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
        const startIdx = (firstDay === 0) ? 6 : firstDay - 1;
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        const cellsHtml = Array.from({length: 35}, (_, i) => {
            const day = i - startIdx + 1;
            if (day > 0 && day <= daysInMonth) {
                const key = `${currentYear}-${currentMonth}-${day}-${currentPage}`;
                const daySchedules = grouped[key] || [];
                const schedulesHtml = daySchedules.map(sch => buildScheduleCardHtml(sch, false)).join('');
                
                const isToday = currentYear === realToday.getFullYear() && currentMonth === realToday.getMonth() + 1 && day === realToday.getDate();
                const displayDay = isToday ? `<span class="bg-[#5D4037] text-white w-7 h-7 inline-flex items-center justify-center rounded-md">${day}</span>` : `<span>${day}</span>`;

                return `<div class="big-cell" onclick="handleDayClick(${currentYear}, ${currentMonth}, ${day}, '${currentPage}')"><div class="w-full flex justify-between items-center mb-1 px-1">${displayDay}</div><div class="w-full flex-1 overflow-y-auto schedule-list flex flex-col gap-1">${schedulesHtml}</div></div>`;
            }
            return `<div class="big-cell cursor-default hover:bg-transparent hover:transform-none hover:shadow-none hover:border-dashed"></div>`;
        }).join('');

        const memoBtnHtml = `
            <button onclick="toggleMemoPanel()" class="absolute top-[40px] right-[40px] flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-[#5D4037] text-[#5D4037] font-bold rounded-xl hover:bg-[#5D4037] hover:text-white transition-all shadow-md font-paperozi text-[18px] z-10 cursor-pointer">
                <i class="fi fi-rr-edit"></i> 메모
            </button>
        `;

        content.innerHTML = `<div class="big-white-box relative theme-${currentPage === '달타'?'dalta':currentPage === '서피카'?'seopika':currentPage === '다룽'?'darung':currentPage === '최또'?'choitto':'kanasi'}">
            ${memoBtnHtml}
            <div class="nav-container"><button class="nav-btn" onclick="changeMonth(-1)"><i class="fi fi-rr-caret-left"></i></button><div class="w-[330px] flex justify-center items-center"><div class="text-[40px] font-normal cursor-pointer hover-theme-text leading-none" style="font-family: 'DnfBitbeatV2', sans-serif;" onclick="openMonthPicker()">${currentYear}년 ${currentMonth}월</div></div><button class="nav-btn" onclick="changeMonth(1)"><i class="fi fi-rr-caret-right"></i></button></div><div class="header-days-container mb-2">${['월','화','수','목','금','토','일'].map(d=>`<div class="header-days-cell" style="padding:22px 0;">${d}</div>`).join('')}</div><div class="big-box-container">${cellsHtml}</div></div>`;
    }
}

// 5. HTML 모듈 연결
window.toggleMenu = toggleMenu;
window.toggleAmpm = toggleAmpm;
window.handleAdminClick = handleAdminClick;
window.checkPassword = checkPassword;
window.logoutAdmin = logoutAdmin;
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.closeLogoutModal = closeLogoutModal;
window.handleDayClick = handleDayClick;
window.showContextMenu = showContextMenu;
window.deleteFromMenu = deleteFromMenu;
window.editFromMenu = editFromMenu;
window.closeEditModal = closeEditModal;
window.saveEditedSchedule = saveEditedSchedule;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.openAllSchedulesModal = openAllSchedulesModal;
window.changeTab = changeTab;
window.changeMonth = changeMonth;
window.openMonthPicker = openMonthPicker;
window.closeMonthPicker = closeMonthPicker;
window.changePickerYear = changePickerYear;
window.selectMonth = selectMonth;
window.addScheduleInputBlock = addScheduleInputBlock;
window.closeScheduleModal = closeScheduleModal;
window.saveSchedule = saveSchedule;
window.toggleFields = toggleFields;
window.toggleMemoPanel = toggleMemoPanel;
window.saveMemo = saveMemo;

// 6. 시작
loadSchedulesFromFirebase();