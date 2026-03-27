import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB989b4dx4ao6So14IWRQwwZ0JybGVMFGQ",
  authDomain: "directorio-santa-ana.firebaseapp.com",
  projectId: "directorio-santa-ana",
  storageBucket: "directorio-santa-ana.firebasestorage.app",
  messagingSenderId: "789802339881",
  appId: "1:789802339881:web:b9e74a336814fec3d55638"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ==========================================
// MODO OSCURO (Dark Mode)
// ==========================================
const btnTheme = document.getElementById('btn-theme-toggle');
const body = document.body;

// Revisar preferencia guardada
if (localStorage.getItem('theme') === 'dark') {
    body.setAttribute('data-theme', 'dark');
    btnTheme.innerText = '☀️';
}

btnTheme.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        btnTheme.innerText = '🌙';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        btnTheme.innerText = '☀️';
    }
});

// ==========================================
// CONTROL DE VISTAS (SPA)
// ==========================================
const vistaDirectorio = document.getElementById('vista-directorio');
const vistaPanel = document.getElementById('vista-panel');
const btnNavPanel = document.getElementById('btn-nav-panel');
const btnVolverDirectorio = document.getElementById('btn-volver-directorio');

btnNavPanel.addEventListener('click', () => {
    vistaDirectorio.style.display = 'none';
    vistaPanel.style.display = 'block';
    window.scrollTo(0,0);
});

btnVolverDirectorio.addEventListener('click', () => {
    vistaPanel.style.display = 'none';
    vistaDirectorio.style.display = 'block';
    cargarServicios(); 
});

// ==========================================
// LÓGICA DEL PANEL DE AUTOGESTIÓN
// ==========================================
let documentoIdActual = null; 
let usuarioActual = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActual = user;
        document.getElementById('seccion-login').style.display = 'none';
        mostrarDashboard();
    } else {
        document.getElementById('seccion-login').style.display = 'flex';
        document.getElementById('seccion-dashboard').style.display = 'none';
        document.getElementById('seccion-formulario').style.display = 'none';
        usuarioActual = null;
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("Error al iniciar sesión."); }
});

async function mostrarDashboard() {
    document.getElementById('seccion-formulario').style.display = 'none';
    document.getElementById('seccion-dashboard').style.display = 'block';
    const contenedorLista = document.getElementById('lista-mis-servicios');
    contenedorLista.innerHTML = "Cargando tus servicios...";

    const q = query(collection(db, "servicios"), where("usuarioId", "==", usuarioActual.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        contenedorLista.innerHTML = "<p>Aún no tienes servicios publicados.</p>";
        return;
    }

    contenedorLista.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        contenedorLista.innerHTML += `
            <div class="item-dashboard fade-in-up">
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${data.nombre}</h3>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${data.categoria}</span>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button onclick="editarServicio('${docSnap.id}')" style="background:var(--primary-color); color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Editar</button>
                    <button onclick="borrarServicio('${docSnap.id}')" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Borrar</button>
                </div>
            </div>
        `;
    });
}

window.editarServicio = async function(id) {
    documentoIdActual = id;
    document.getElementById('seccion-dashboard').style.display = 'none';
    document.getElementById('seccion-formulario').style.display = 'block';
    document.getElementById('titulo-formulario').innerText = "Editar Servicio";
    
    const q = query(collection(db, "servicios"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
        if (docSnap.id === id) {
            const data = docSnap.data();
            document.getElementById('nombre').value = data.nombre || '';
            document.getElementById('categoria').value = data.categoria || '';
            document.getElementById('ubicacion').value = data.ubicacion || 'A domicilio';
            document.getElementById('whatsapp').value = data.whatsapp || '';
            document.getElementById('instagram').value = data.instagram || '';
            document.getElementById('facebook').value = data.facebook || '';
            document.getElementById('descripcion').value = data.descripcion || '';
            document.getElementById('urgencias').checked = data.urgencias || false;
            document.getElementById('presupuesto').checked = data.presupuesto || false;
        }
    });
};

window.borrarServicio = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este servicio definitivamente?")) {
        await deleteDoc(doc(db, "servicios", id));
        mostrarDashboard();
    }
};

document.getElementById('btn-crear-nuevo').addEventListener('click', () => {
    documentoIdActual = null;
    document.getElementById('form-servicio').reset();
    document.getElementById('seccion-dashboard').style.display = 'none';
    document.getElementById('seccion-formulario').style.display = 'block';
    document.getElementById('titulo-formulario').innerText = "Nuevo Servicio";
});

document.getElementById('btn-cancelar').addEventListener('click', () => { mostrarDashboard(); });

document.getElementById('form-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-guardar');
    btnSubmit.innerText = "Guardando..."; btnSubmit.disabled = true;

    const datos = {
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        ubicacion: document.getElementById('ubicacion').value,
        whatsapp: document.getElementById('whatsapp').value,
        instagram: document.getElementById('instagram').value,
        facebook: document.getElementById('facebook').value,
        descripcion: document.getElementById('descripcion').value,
        urgencias: document.getElementById('urgencias').checked,
        presupuesto: document.getElementById('presupuesto').checked,
        usuarioId: usuarioActual.uid, 
        ultimaActualizacion: new Date()
    };

    try {
        if (documentoIdActual) { await updateDoc(doc(db, "servicios", documentoIdActual), datos); } 
        else { await addDoc(collection(db, "servicios"), datos); }
        mostrarDashboard();
    } catch (error) { alert("Error al guardar."); } 
    finally { btnSubmit.innerText = "Guardar Servicio"; btnSubmit.disabled = false; }
});

// ==========================================
// COMPARTIR PERFIL (Web Share API)
// ==========================================
window.compartirPerfil = function(nombre, categoria) {
    if (navigator.share) {
        navigator.share({
            title: nombre,
            text: `Mira este profesional en Santa Ana: ${nombre} (${categoria})`,
            url: window.location.href
        }).catch(console.error);
    } else {
        alert("Para compartir, copia la dirección web de esta página.");
    }
};

// ==========================================
// DIRECTORIO, BUSCADOR Y FILTROS
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
const contadorTexto = document.getElementById('contador-profesionales');
let filtroActivo = ""; // urgencias, online, domicilio

async function cargarServicios() {
    // 1. Mostrar Skeletons
    listaServicios.innerHTML = `
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    `;

    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        
        // 2. Actualizar Contador Dinámico
        const cantidad = querySnapshot.size;
        contadorTexto.innerText = `⭐ Ya somos ${cantidad} profesionales listos para ayudarte`;

        if (querySnapshot.empty) {
            listaServicios.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Aún no hay servicios publicados. ¡Sé el primero!</p>"; return;
        }

        let delayAnimacion = 0; // Para el efecto escalonado

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const waNumero = data.whatsapp.replace(/\D/g,''); 
            
            let badgesHTML = "";
            if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 24hs</span>`;
            if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Sin Cargo</span>`;

            let redesHTML = "";
            if (data.instagram || data.facebook) {
                redesHTML += `<div class="redes-sociales">`;
                if (data.instagram) {
                    let igLink = data.instagram.includes('http') ? data.instagram : `https://instagram.com/${data.instagram.replace('@','')}`;
                    redesHTML += `<a href="${igLink}" target="_blank" class="btn-social btn-ig">Instagram</a>`;
                }
                if (data.facebook) {
                    let fbLink = data.facebook.includes('http') ? data.facebook : `https://${data.facebook}`;
                    redesHTML += `<a href="${fbLink}" target="_blank" class="btn-social btn-fb">Facebook</a>`;
                }
                redesHTML += `</div>`;
            }

            // Datos invisibles para ayudar a los filtros lógicos
            const esOnline = data.ubicacion.includes('Online') ? 'true' : 'false';
            const esDomicilio = data.ubicacion.includes('domicilio') ? 'true' : 'false';

            const tarjetaHTML = `
                <article class="tarjeta-servicio fade-in-up" 
                         style="animation-delay: ${delayAnimacion}s;"
                         data-urgencias="${data.urgencias || false}"
                         data-online="${esOnline}"
                         data-domicilio="${esDomicilio}">
                    
                    <div class="card-header">
                        <div class="categoria-tag">${data.categoria}</div>
                        <button class="btn-share" onclick="compartirPerfil('${data.nombre}', '${data.categoria}')" title="Compartir Perfil">🔗</button>
                    </div>
                    
                    <h2>${data.nombre}</h2>
                    ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                    <p class="descripcion">${data.descripcion}</p>
                    
                    <div class="info-extra">
                        <span>📍 ${data.ubicacion || 'Consultar'}</span>
                    </div>
                    
                    ${redesHTML}
                    <a href="https://wa.me/${waNumero}?text=Hola,%20vi%20tu%20perfil%20en%20el%20directorio" target="_blank" class="btn-whatsapp pulse-subtle">
                        Contactar
                    </a>
                </article>
            `;
            listaServicios.innerHTML += tarjetaHTML;
            delayAnimacion += 0.1; // Siguiente tarjeta aparece 0.1s más tarde
        });

    } catch (error) { listaServicios.innerHTML = "<p style='color: red;'>Error de conexión.</p>"; }
}

// Lógica del Buscador + Filtros combinados
function aplicarFiltros() {
    const textoBusqueda = document.getElementById('buscador').value.toLowerCase();
    const tarjetas = document.querySelectorAll('.tarjeta-servicio');

    tarjetas.forEach(tarjeta => {
        const contenido = tarjeta.innerText.toLowerCase();
        const coincideTexto = contenido.includes(textoBusqueda);
        
        let coincideFiltroRapido = true;
        if (filtroActivo === 'urgencias') coincideFiltroRapido = tarjeta.dataset.urgencias === 'true';
        if (filtroActivo === 'online') coincideFiltroRapido = tarjeta.dataset.online === 'true';
        if (filtroActivo === 'domicilio') coincideFiltroRapido = tarjeta.dataset.domicilio === 'true';

        tarjeta.style.display = (coincideTexto && coincideFiltroRapido) ? 'flex' : 'none';
    });
}

document.getElementById('buscador').addEventListener('input', aplicarFiltros);

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Toggle botón visualmente
        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            filtroActivo = "";
        } else {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.dataset.filter;
        }
        aplicarFiltros();
    });
});

cargarServicios();
