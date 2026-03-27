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
// CONTROL DE VISTAS (SPA)
// ==========================================
const vistaDirectorio = document.getElementById('vista-directorio');
const vistaPanel = document.getElementById('vista-panel');
const btnNavPanel = document.getElementById('btn-nav-panel');
const btnVolverDirectorio = document.getElementById('btn-volver-directorio');

btnNavPanel.addEventListener('click', () => {
    vistaDirectorio.style.display = 'none';
    vistaPanel.style.display = 'block';
});

btnVolverDirectorio.addEventListener('click', () => {
    vistaPanel.style.display = 'none';
    vistaDirectorio.style.display = 'block';
    cargarServicios(); // Recarga por si se editó algo
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
            <div class="item-dashboard">
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${data.nombre}</h3>
                    <span style="font-size: 0.8rem; color: #666;">${data.categoria}</span>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button onclick="editarServicio('${docSnap.id}')" style="background:#2563eb; color:white; border:none; padding:0.5rem; border-radius:6px; cursor:pointer;">Editar</button>
                    <button onclick="borrarServicio('${docSnap.id}')" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:6px; cursor:pointer;">Borrar</button>
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
    if(confirm("¿Seguro que deseas eliminar este servicio?")) {
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
        alert("¡Servicio guardado exitosamente!");
        mostrarDashboard();
    } catch (error) { alert("Error al guardar."); } 
    finally { btnSubmit.innerText = "Guardar Servicio"; btnSubmit.disabled = false; }
});

// ==========================================
// LÓGICA DEL DIRECTORIO Y BUSCADOR
// ==========================================
const listaServicios = document.getElementById('lista-servicios');

async function cargarServicios() {
    listaServicios.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Cargando profesionales...</p>";
    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        if (querySnapshot.empty) {
            listaServicios.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Aún no hay servicios publicados. ¡Sé el primero!</p>"; return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const waNumero = data.whatsapp.replace(/\D/g,''); 
            
            let badgesHTML = "";
            if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 Urgencias 24hs</span>`;
            if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Presupuesto sin cargo</span>`;

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

            const tarjetaHTML = `
                <article class="tarjeta-servicio">
                    <div class="categoria-tag">${data.categoria}</div>
                    <h2>${data.nombre}</h2>
                    ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                    <p class="descripcion">${data.descripcion}</p>
                    <div class="info-extra">
                        <span>📍 ${data.ubicacion || 'A convenir'}</span>
                    </div>
                    ${redesHTML}
                    <a href="https://wa.me/${waNumero}?text=Hola,%20vi%20tu%20perfil%20en%20el%20directorio" target="_blank" class="btn-whatsapp">
                        Contactar por WhatsApp
                    </a>
                </article>
            `;
            listaServicios.innerHTML += tarjetaHTML;
        });
    } catch (error) { listaServicios.innerHTML = "<p style='color: red;'>Error de conexión.</p>"; }
}

document.getElementById('buscador').addEventListener('input', (e) => {
    const textoBusqueda = e.target.value.toLowerCase();
    document.querySelectorAll('.tarjeta-servicio').forEach(tarjeta => {
        const contenido = tarjeta.innerText.toLowerCase();
        tarjeta.style.display = contenido.includes(textoBusqueda) ? 'flex' : 'none';
    });
});

cargarServicios(); // Cargar al inicio
