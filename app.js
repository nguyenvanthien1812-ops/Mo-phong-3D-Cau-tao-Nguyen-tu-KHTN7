/**
 * KHTN 7 - Bài 2: Cấu tạo nguyên tử
 * Mô phỏng 3D Nguyên tử Carbon theo mô hình Rutherford - Bohr
 */

// --- ĐỊNH NGHĨA TRẠNG THÁI (STATE) ---
const state = {
    isPlaying: true,
    speedMultiplier: 1.0,
    isExploded: false,
    showOrbits: true,
    showLabels: true,
    autoRotate: false,
    explodeFactor: 0.0, // 0.0: bình thường, 1.0: bóc tách hoàn toàn
    currentGuideStep: 0,
};

// --- CÁC THÔNG SỐ KỸ THUẬT ---
const CONSTANTS = {
    ORBIT_1_RADIUS: 4.5,
    ORBIT_2_RADIUS: 8.5,
    ELECTRON_SIZE: 0.28,
    PARTICLE_SIZE: 0.42, // Kích thước Proton và Neutron
    EXPLODE_ORBIT_SCALE: 2.2, // Hệ số giãn nở của vỏ khi bóc tách
    EXPLODE_NUCLEUS_SCALE: 1.6, // Hệ số giãn nở hạt nhân để đếm hạt
    BASE_ELECTRON_SPEED: 0.02,
};

// --- PHẦN TỬ GIAO DIỆN (DOM ELEMENTS) ---
const dom = {
    container: document.getElementById('canvas3d'),
    labelsOverlay: document.getElementById('labels-overlay'),
    
    // Nút bấm
    btnExplode: document.getElementById('btn-explode'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    btnAutoRotate: document.getElementById('btn-auto-rotate'),
    btnToggleOrbits: document.getElementById('btn-toggle-orbits'),
    btnToggleLabels: document.getElementById('btn-toggle-labels'),
    btnToggleGuidePanel: document.getElementById('btn-toggle-guide-panel'),
    btnReset: document.getElementById('btn-reset'),
    
    // Slider
    sliderSpeed: document.getElementById('slider-speed'),
    speedValue: document.getElementById('speed-value'),
    
    // Lời dẫn & Gợi ý
    teacherGuide: document.getElementById('teacher-guide'),
    btnToggleGuide: document.getElementById('btn-toggle-guide'),
    toggleGuideHeader: document.getElementById('toggle-guide-header'),
    btnPrevGuide: document.getElementById('prev-guide'),
    btnNextGuide: document.getElementById('next-guide'),
    guideIndicator: document.getElementById('guide-indicator'),
    guideSteps: document.querySelectorAll('.guide-step'),
    toggleGuideBtnText: document.getElementById('toggle-guide-btn-text'),
};

// --- KHỞI TẠO THREE.JS ---
let scene, camera, renderer, controls;
let nucleusGroup, orbitGroup1, orbitGroup2;
let protons = [], neutrons = [], electrons = [];
let orbitLine1, orbitLine2;
let labelElements = {};

// Điểm neo nhãn (Helper meshes) để tính tọa độ 3D
let anchorNucleus, anchorOrbit1, anchorOrbit2;

// Vị trí gốc của các hạt trong hạt nhân (để tính hiệu ứng giãn nở)
const originalNucleusPositions = [
    // Tầng trung tâm
    { pos: new THREE.Vector3(0.25, 0.25, 0.25), type: 'p' },
    { pos: new THREE.Vector3(-0.25, 0.25, -0.25), type: 'n' },
    { pos: new THREE.Vector3(0.25, -0.25, -0.25), type: 'p' },
    { pos: new THREE.Vector3(-0.25, -0.25, 0.25), type: 'n' },
    
    // Tầng ngoài ôm sát
    { pos: new THREE.Vector3(0.65, 0.1, 0.1), type: 'p' },
    { pos: new THREE.Vector3(-0.65, -0.1, -0.1), type: 'n' },
    { pos: new THREE.Vector3(0.1, 0.65, -0.1), type: 'p' },
    { pos: new THREE.Vector3(-0.1, -0.65, 0.1), type: 'n' },
    { pos: new THREE.Vector3(-0.1, 0.1, 0.65), type: 'p' },
    { pos: new THREE.Vector3(0.1, -0.1, -0.65), type: 'n' },
    
    // Hai hạt chốt khóa hai đầu
    { pos: new THREE.Vector3(0.35, 0.35, -0.35), type: 'p' },
    { pos: new THREE.Vector3(-0.35, -0.35, 0.35), type: 'n' }
];

function init() {
    // 1. Tạo Scene & Renderer
    scene = new THREE.Scene();
    
    const width = dom.container.clientWidth;
    const height = dom.container.clientHeight;
    
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 6, 16);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    dom.container.appendChild(renderer.domElement);
    
    // 2. Thêm OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.target.set(0, 0, 0);
    
    // 3. Hệ thống Ánh sáng Studio
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(0x00d2d3, 0.3); // Ánh sáng xanh nhẹ hắt ngược
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);
    
    // Ánh sáng phát ra từ hạt nhân (PointLight)
    const nucleusLight = new THREE.PointLight(0xffffff, 1.2, 8);
    scene.add(nucleusLight);
    
    // 4. Tạo mô hình nguyên tử
    createAtom();
    
    // 5. Khởi tạo nhãn chú thích
    createLabels();
    
    // 6. Gán sự kiện cho UI
    setupEventListeners();
    
    // 7. Bắt đầu vòng lặp Render
    animate();
}

// --- TẠO MÔ HÌNH NGUYÊN TỬ (ATOM) ---
function createAtom() {
    // A. NHÓM HẠT NHÂN (NUCLEUS)
    nucleusGroup = new THREE.Group();
    scene.add(nucleusGroup);
    
    // Canvas vẽ dấu "+" cho hạt Proton
    const protonTexture = createProtonTexture();
    
    // Vật liệu cho Proton (Đỏ bóng) và Neutron (Xám bạc bóng)
    const protonMaterial = new THREE.MeshStandardMaterial({
        map: protonTexture,
        roughness: 0.1,
        metalness: 0.1,
        bumpScale: 0.05
    });
    
    const neutronMaterial = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Màu xám rõ ràng
        roughness: 0.3,
        metalness: 0.0, // Không dùng metalness để tránh phản chiếu màu đen của không gian nền
    });
    
    const sphereGeometry = new THREE.SphereGeometry(CONSTANTS.PARTICLE_SIZE, 32, 32);
    
    originalNucleusPositions.forEach((item, index) => {
        const mesh = new THREE.Mesh(
            sphereGeometry, 
            item.type === 'p' ? protonMaterial : neutronMaterial
        );
        mesh.position.copy(item.pos);
        nucleusGroup.add(mesh);
        
        if (item.type === 'p') {
            protons.push(mesh);
        } else {
            neutrons.push(mesh);
        }
    });
    
    // Điểm neo cho nhãn Hạt nhân ở chính giữa tâm
    anchorNucleus = new THREE.Object3D();
    scene.add(anchorNucleus);
    
    // B. LỚP VỎ ELECTRON
    // Lớp 1 (Inner Shell): 2 electrons, nghiêng góc X
    orbitGroup1 = new THREE.Group();
    orbitGroup1.rotation.x = Math.PI / 6; // Nghiêng 30 độ
    orbitGroup1.rotation.y = Math.PI / 12; // Nghiêng 15 độ
    scene.add(orbitGroup1);
    
    orbitLine1 = createOrbitLine(CONSTANTS.ORBIT_1_RADIUS);
    orbitGroup1.add(orbitLine1);
    
    // Lớp 2 (Outer Shell): 4 electrons, nghiêng ngược lại
    orbitGroup2 = new THREE.Group();
    orbitGroup2.rotation.x = -Math.PI / 5; // Nghiêng -36 độ
    orbitGroup2.rotation.y = -Math.PI / 10; // Nghiêng -18 độ
    scene.add(orbitGroup2);
    
    orbitLine2 = createOrbitLine(CONSTANTS.ORBIT_2_RADIUS);
    orbitGroup2.add(orbitLine2);
    
    // Tạo Electron (Màu xanh cyan phát sáng nhẹ)
    const electronGeometry = new THREE.SphereGeometry(CONSTANTS.ELECTRON_SIZE, 24, 24);
    const electronMaterial = new THREE.MeshStandardMaterial({
        color: 0x00d2d3,
        emissive: 0x00d2d3,
        emissiveIntensity: 0.6,
        roughness: 0.1,
        metalness: 0.1
    });
    
    // 2 electron trên Quỹ đạo 1 (cách nhau 180 độ)
    for (let i = 0; i < 2; i++) {
        const electron = new THREE.Mesh(electronGeometry, electronMaterial);
        electron.userData = { 
            orbit: 1, 
            angle: (i / 2) * Math.PI * 2,
            radius: CONSTANTS.ORBIT_1_RADIUS 
        };
        orbitGroup1.add(electron);
        electrons.push(electron);
    }
    
    // 4 electron trên Quỹ đạo 2 (cách nhau 90 độ)
    for (let i = 0; i < 4; i++) {
        const electron = new THREE.Mesh(electronGeometry, electronMaterial);
        electron.userData = { 
            orbit: 2, 
            angle: (i / 4) * Math.PI * 2,
            radius: CONSTANTS.ORBIT_2_RADIUS 
        };
        orbitGroup2.add(electron);
        electrons.push(electron);
    }
    
    // Điểm neo nhãn cho 2 lớp vỏ (đặt cố định trên vòng quỹ đạo)
    anchorOrbit1 = new THREE.Object3D();
    anchorOrbit1.position.set(0, 0, -CONSTANTS.ORBIT_1_RADIUS);
    orbitGroup1.add(anchorOrbit1);
    
    anchorOrbit2 = new THREE.Object3D();
    anchorOrbit2.position.set(0, 0, CONSTANTS.ORBIT_2_RADIUS);
    orbitGroup2.add(anchorOrbit2);
}

// Hàm vẽ texture dấu "+" cho Proton bằng Canvas 2D
function createProtonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Nền đỏ hạt proton
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(0, 0, 128, 128);
    
    // Vẽ dấu + màu trắng dày ở giữa
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(64, 28);
    ctx.lineTo(64, 100);
    ctx.moveTo(28, 64);
    ctx.lineTo(100, 64);
    ctx.stroke();
    
    return new THREE.CanvasTexture(canvas);
}

// Tạo vòng tròn Line màu vàng cho Quỹ đạo
function createOrbitLine(radius) {
    const points = [];
    const segments = 90;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xf1c40f,
        transparent: true,
        opacity: 0.6,
        linewidth: 1.5 // Hỗ trợ hầu hết trình duyệt
    });
    
    return new THREE.LineLoop(geometry, material);
}

// --- TẠO VÀ CẬP NHẬT NHÃN CHÚ THÍCH (LABELS OVERLAY) ---
function createLabels() {
    const labelsData = [
        { id: 'orbit1', text: 'Lớp electron trong cùng (2 electron)', className: 'badge-orbit-1' },
        { id: 'orbit2', text: 'Lớp electron ngoài cùng (4 electron)', className: 'badge-orbit-2' }
    ];
    
    labelsData.forEach(data => {
        const div = document.createElement('div');
        div.className = `badge-label ${data.className}`;
        div.innerText = data.text;
        dom.labelsOverlay.appendChild(div);
        labelElements[data.id] = div;
    });
}

const tempV = new THREE.Vector3();
function updateLabelPositions() {
    if (!state.showLabels) {
        Object.values(labelElements).forEach(el => el.style.opacity = '0');
        return;
    }
    
    const anchors = {
        nucleus: anchorNucleus,
        orbit1: anchorOrbit1,
        orbit2: anchorOrbit2
    };
    
    for (const [id, anchor] of Object.entries(anchors)) {
        const element = labelElements[id];
        if (!element) continue;
        
        anchor.getWorldPosition(tempV);
        tempV.project(camera);
        
        // Ẩn nhãn nếu nó nằm sau camera (tránh lỗi hiển thị ngược)
        if (tempV.z > 1) {
            element.style.display = 'none';
            continue;
        }
        
        element.style.display = 'flex';
        
        // Chuyển đổi hệ tọa độ 3D (-1 đến 1) sang tọa độ màn hình HTML (%)
        const x = (tempV.x * 0.5 + 0.5) * dom.container.clientWidth;
        const y = (tempV.y * -0.5 + 0.5) * dom.container.clientHeight;
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.opacity = '1';
    }
}

// --- VÒNG LẶP ANIMATION (RENDER LOOP) ---
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    
    // 1. Cập nhật góc quay của electron (chuyển động quay)
    if (state.isPlaying) {
        time += CONSTANTS.BASE_ELECTRON_SPEED * state.speedMultiplier;
    }
    
    electrons.forEach(el => {
        // Cập nhật vị trí electron dọc theo đường tròn quỹ đạo phẳng
        const orbitRadius = el.userData.radius;
        const currentAngle = el.userData.angle + time * (el.userData.orbit === 1 ? 1.3 : 1.0); // Electron vòng trong quay nhanh hơn một chút
        
        el.position.x = Math.cos(currentAngle) * orbitRadius;
        el.position.z = Math.sin(currentAngle) * orbitRadius;
    });
    
    // 2. Cập nhật hiệu ứng LERP cho "Bóc tách nguyên tử" (Explode/Collapse)
    const targetFactor = state.isExploded ? 1.0 : 0.0;
    state.explodeFactor += (targetFactor - state.explodeFactor) * 0.08; // Nội suy mượt mà
    
    // A. Giãn nở hai lớp quỹ đạo electron
    const currentScale = 1.0 + state.explodeFactor * (CONSTANTS.EXPLODE_ORBIT_SCALE - 1.0);
    orbitGroup1.scale.setScalar(currentScale);
    orbitGroup2.scale.setScalar(currentScale);
    
    // Để giữ các hạt electron không bị méo/giãn to khi Group bị scale:
    electrons.forEach(el => {
        el.scale.setScalar(1.0 / currentScale);
    });
    
    // B. Giãn nở cụm hạt nhân để nhìn thấy rõ từng hạt p và n
    const nucleusScaleFactor = 1.0 + state.explodeFactor * (CONSTANTS.EXPLODE_NUCLEUS_SCALE - 1.0);
    
    // Cập nhật vị trí từng hạt nhân con
    let particleIndex = 0;
    protons.forEach(p => {
        const originalPos = originalNucleusPositions[particleIndex].pos;
        p.position.copy(originalPos).multiplyScalar(nucleusScaleFactor);
        particleIndex++;
    });
    neutrons.forEach(n => {
        const originalPos = originalNucleusPositions[particleIndex].pos;
        n.position.copy(originalPos).multiplyScalar(nucleusScaleFactor);
        particleIndex++;
    });
    
    // C. Tự động thu phóng (zoom) và di chuyển camera mượt mà khi bóc tách
    if (state.isExploded) {
        // Hướng camera tập trung sâu vào tâm
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.08);
        
        // Zoom gần lại (bảo toàn góc xoay hiện tại của giáo viên)
        const cameraDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        const currentDist = camera.position.distanceTo(controls.target);
        const targetDist = 7.5; // Zoom cận cảnh hạt nhân
        const newDist = THREE.MathUtils.lerp(currentDist, targetDist, 0.06);
        camera.position.copy(controls.target).addScaledVector(cameraDir, newDist);
    } else {
        // Khi gộp lại, nếu camera quá gần thì tự động lùi ra
        const currentDist = camera.position.distanceTo(controls.target);
        if (currentDist < 12.0) {
            const cameraDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
            const targetDist = 15.0;
            const newDist = THREE.MathUtils.lerp(currentDist, targetDist, 0.06);
            camera.position.copy(controls.target).addScaledVector(cameraDir, newDist);
        }
    }
    
    // 3. Tự động xoay camera (Auto Rotate)
    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = 1.5;
    
    // Cập nhật OrbitControls
    controls.update();
    
    // 4. Định vị nhãn chú thích
    updateLabelPositions();
    
    // 5. Render Scene chính
    renderer.render(scene, camera);
}

// --- THIẾT LẬP SỰ KIỆN TƯƠNG TÁC (EVENT LISTENERS) ---
function setupEventListeners() {
    // 1. Co giãn màn hình (Resize)
    window.addEventListener('resize', onWindowResize);
    
    // 2. Nút Bóc tách / Gộp nguyên tử
    dom.btnExplode.addEventListener('click', toggleExplode);
    
    // 3. Nút Bắt đầu / Tạm dừng
    dom.btnPlayPause.addEventListener('click', togglePlayPause);
    
    // 4. Nút Xoay camera tự động
    dom.btnAutoRotate.addEventListener('click', toggleAutoRotate);
    
    // 5. Nút Bật/Tắt Quỹ đạo
    dom.btnToggleOrbits.addEventListener('click', toggleOrbits);
    
    // 6. Nút Bật/Tắt Chú thích
    dom.btnToggleLabels.addEventListener('click', toggleLabels);
    
    // 7. Thanh trượt Tốc độ electron
    dom.sliderSpeed.addEventListener('input', (e) => {
        state.speedMultiplier = parseFloat(e.target.value);
        dom.speedValue.innerText = state.speedMultiplier.toFixed(1) + 'x';
    });
    
    // 8. Bảng gợi ý Lời dẫn Giáo viên
    dom.toggleGuideHeader.addEventListener('click', toggleGuidePanel);
    dom.btnToggleGuidePanel.addEventListener('click', toggleGuidePanel);
    dom.btnPrevGuide.addEventListener('click', () => navigateGuide(-1));
    dom.btnNextGuide.addEventListener('click', () => navigateGuide(1));
    
    // 9. Nút Làm lại (Reset)
    dom.btnReset.addEventListener('click', resetSimulation);
    
    // 10. Nút Toàn màn hình
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', onFullscreenChange);
    }
}

// --- CÁC HÀM XỬ LÝ SỰ KIỆN CHI TIẾT ---

function onWindowResize() {
    const width = dom.container.clientWidth;
    const height = dom.container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

function toggleExplode() {
    state.isExploded = !state.isExploded;
    
    if (state.isExploded) {
        dom.btnExplode.classList.add('btn-secondary');
        dom.btnExplode.classList.remove('btn-primary');
        dom.btnExplode.innerHTML = `
            <svg class="icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 10.5 12 12.01 16.5 10.5" />
                <line x1="12" y1="12" x2="12" y2="3" />
            </svg>
            <span>Gộp nguyên tử</span>
        `;
        
        // Tự động điều hướng Lời dẫn Sư phạm đến bước Bóc tách
        setGuideStep(2); // Bước 3 (index 2) trong danh sách
        openGuidePanel();
    } else {
        dom.btnExplode.classList.add('btn-primary');
        dom.btnExplode.classList.remove('btn-secondary');
        dom.btnExplode.innerHTML = `
            <svg class="icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Bóc tách nguyên tử</span>
        `;
    }
}

function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    
    const playIcon = dom.btnPlayPause.querySelector('.play-icon');
    const pauseIcon = dom.btnPlayPause.querySelector('.pause-icon');
    const textSpan = document.getElementById('play-pause-text');
    
    if (state.isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        textSpan.innerText = 'Tạm dừng';
        dom.btnPlayPause.classList.remove('active');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        textSpan.innerText = 'Bắt đầu';
        dom.btnPlayPause.classList.add('active');
    }
}

function toggleAutoRotate() {
    state.autoRotate = !state.autoRotate;
    
    if (state.autoRotate) {
        dom.btnAutoRotate.classList.add('active');
    } else {
        dom.btnAutoRotate.classList.remove('active');
    }
}

function toggleOrbits() {
    state.showOrbits = !state.showOrbits;
    
    if (state.showOrbits) {
        dom.btnToggleOrbits.classList.add('active');
        orbitLine1.visible = true;
        orbitLine2.visible = true;
    } else {
        dom.btnToggleOrbits.classList.remove('active');
        orbitLine1.visible = false;
        orbitLine2.visible = false;
    }
}

function toggleLabels() {
    state.showLabels = !state.showLabels;
    
    if (state.showLabels) {
        dom.btnToggleLabels.classList.add('active');
        Object.values(labelElements).forEach(el => el.style.opacity = '1');
    } else {
        dom.btnToggleLabels.classList.remove('active');
        Object.values(labelElements).forEach(el => el.style.opacity = '0');
    }
}

// Bảng gợi ý Sư phạm
function toggleGuidePanel() {
    const isCollapsed = dom.teacherGuide.classList.contains('collapsed');
    
    if (isCollapsed) {
        openGuidePanel();
    } else {
        closeGuidePanel();
    }
}

function openGuidePanel() {
    dom.teacherGuide.classList.remove('collapsed');
    dom.btnToggleGuidePanel.classList.add('active');
    dom.toggleGuideBtnText.innerText = 'Ẩn lời dẫn';
}

function closeGuidePanel() {
    dom.teacherGuide.classList.add('collapsed');
    dom.btnToggleGuidePanel.classList.remove('active');
    dom.toggleGuideBtnText.innerText = 'Hiện lời dẫn';
}

function setGuideStep(stepIndex) {
    state.currentGuideStep = stepIndex;
    
    dom.guideSteps.forEach((step, idx) => {
        if (idx === stepIndex) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    dom.guideIndicator.innerText = `${stepIndex + 1} / ${dom.guideSteps.length}`;
    
    dom.btnPrevGuide.disabled = (stepIndex === 0);
    dom.btnNextGuide.disabled = (stepIndex === dom.guideSteps.length - 1);
}

function navigateGuide(direction) {
    let nextStep = state.currentGuideStep + direction;
    if (nextStep >= 0 && nextStep < dom.guideSteps.length) {
        setGuideStep(nextStep);
    }
}

// Khôi phục mọi cài đặt về mặc định
function resetSimulation() {
    // Reset states
    state.isPlaying = true;
    state.speedMultiplier = 1.0;
    state.isExploded = false;
    state.showOrbits = true;
    state.showLabels = true;
    state.autoRotate = false;
    state.explodeFactor = 0.0;
    
    // Reset sliders
    dom.sliderSpeed.value = 1.0;
    dom.speedValue.innerText = '1.0x';
    
    // Reset buttons class state
    dom.btnPlayPause.classList.remove('active');
    dom.btnPlayPause.querySelector('.play-icon').classList.add('hidden');
    dom.btnPlayPause.querySelector('.pause-icon').classList.remove('hidden');
    document.getElementById('play-pause-text').innerText = 'Tạm dừng';
    
    dom.btnAutoRotate.classList.remove('active');
    
    dom.btnToggleOrbits.classList.add('active');
    orbitLine1.visible = true;
    orbitLine2.visible = true;
    
    dom.btnToggleLabels.classList.add('active');
    
    dom.btnExplode.classList.add('btn-primary');
    dom.btnExplode.classList.remove('btn-secondary');
    dom.btnExplode.innerHTML = `
        <svg class="icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <span>Bóc tách nguyên tử</span>
    `;
    
    // Reset camera & controls
    camera.position.set(0, 6, 16);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Reset guide steps
    setGuideStep(0);
    closeGuidePanel();
    
    // Reset groups
    orbitGroup1.scale.setScalar(1.0);
    orbitGroup2.scale.setScalar(1.0);
    electrons.forEach(el => el.scale.setScalar(1.0));
    
    let particleIndex = 0;
    protons.forEach(p => {
        p.position.copy(originalNucleusPositions[particleIndex].pos);
        particleIndex++;
    });
    neutrons.forEach(n => {
        n.position.copy(originalNucleusPositions[particleIndex].pos);
        particleIndex++;
    });
    
    time = 0;
}

// --- XỬ LÝ TOÀN MÀN HÌNH (FULLSCREEN) ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error enabling full-screen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function onFullscreenChange() {
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (!btnFullscreen) return;
    
    const icon = btnFullscreen.querySelector('svg');
    const spanText = btnFullscreen.querySelector('span');
    
    if (document.fullscreenElement) {
        spanText.innerText = 'Thu nhỏ';
        icon.innerHTML = '<path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4" />';
    } else {
        spanText.innerText = 'Toàn màn hình';
        icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />';
    }
}

// Khởi chạy ứng dụng khi DOM tải xong
document.addEventListener('DOMContentLoaded', init);
