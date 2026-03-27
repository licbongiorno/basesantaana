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
// LÓGICA DEL PANEL DE AUTOGESTIÓN
// ==========================================
const btnLogin = document.getElementById('btn-login');
if (btnLogin) { 
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

    btnLogin.addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } catch (e) { alert("Error al iniciar sesión."); }
    });

    // Cargar y mostrar la lista de servicios del usuario
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

    // Funciones globales para que los botones generados dinámicamente puedan llamarlas
    window.editarServicio = async function(id) {
        documentoIdActual = id;
        document.getElementById('seccion-dashboard').style.display = 'none';
        document.getElementById('seccion-formulario').style.display = 'block';
        document.getElementById('titulo-formulario').innerText = "Editar Servicio";
        
        // Buscar datos para rellenar
        const q = query(collection(db, "servicios")); // Se podría buscar directo por doc, pero reutilizamos para simplicidad de lectura
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
            if (docSnap.id === id) {
                const data = docSnap.data();
                document.getElementById('nombre').value = data.nombre || '';
                document.getElementById('categoria').value = data.categoria || '';
                document.getElementById('ubicacion').value = data.ubicacion || 'A domicilio';
                document.getElementById('whatsapp').value = data.whatsapp || '';
                document.getElementById('instagram').value = data.instagram || '';
                document.getElementById('descripcion').value = data.descripcion || '';
                
                document.getElementById('urgencias').checked = data.urgencias || false;
                document.getElementById('presupuesto').checked = data.presupuesto || false;
                document.getElementById('pago_efectivo').checked = data.pago_efectivo !== false; // true por defecto
                document.getElementById('pago_transferencia').checked = data.pago_transferencia || false;
                document.getElementById('pago_tarjeta').checked = data.pago_tarjeta || false;
            }
        });
    };

    window.borrarServicio = async function(id) {
        if(confirm("¿Seguro que deseas eliminar este servicio definitivamente?")) {
            await deleteDoc(doc(db, "servicios", id));
            mostrarDashboard();
        }
    };

    // Botón para crear uno nuevo desde cero
    document.getElementById('btn-crear-nuevo').addEventListener('click', () => {
        documentoIdActual = null;
        document.getElementById('form-servicio').reset();
        document.getElementById('seccion-dashboard').style.display = 'none';
        document.getElementById('seccion-formulario').style.display = 'block';
        document.getElementById('titulo-formulario').innerText = "Nuevo Servicio";
    });

    // Botón cancelar dentro del form
    document.getElementById('btn-cancelar').addEventListener('click', () => {
        mostrarDashboard();
    });

    // Guardar (Nuevo o Edición)
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
            descripcion: document.getElementById('descripcion').value,
            urgencias: document.getElementById('urgencias').checked,
            presupuesto: document.getElementById('presupuesto').checked,
            pago_efectivo: document.getElementById('pago_efectivo').checked,
            pago_transferencia: document.getElementById('pago_transferencia').checked,
            pago_tarjeta: document.getElementById('pago_tarjeta').checked,
            usuarioId: usuarioActual.uid, 
            ultimaActualizacion: new Date()
        };

        try {
            if (documentoIdActual) {
                await updateDoc(doc(db, "servicios", documentoIdActual), datos);
            } else {
                await addDoc(collection(db, "servicios"), datos);
            }
            alert("¡Servicio guardado exitosamente!");
            mostrarDashboard();
        } catch (error) {
            alert("Error al guardar.");
        } finally {
            btnSubmit.innerText = "Guardar Servicio"; btnSubmit.disabled = false;
        }
    });
}

// ==========================================
// LÓGICA DEL INICIO (Listado y Buscador)
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
if (listaServicios) { 
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
                
                // Construir Badges de Neuromarketing
                let badgesHTML = "";
                if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 Urgencias 24hs</span>`;
                if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Presupuesto sin cargo</span>`;
                
                // Construir Info de Pagos
                let pagos = [];
                if(data.pago_efectivo) pagos.push("Efectivo");
                if(data.pago_transferencia) pagos.push("Transf/MP");
                if(data.pago_tarjeta) pagos.push("Tarjetas");
                let pagosText = pagos.length > 0 ? `💳 Acepta: ${pagos.join(', ')}` : "Consultar medios de pago";

                // Redes
                let redesHTML = "";
                if (data.instagram) {
                    const igUser = data.instagram.replace('@', '');
                    redesHTML = `<div class="redes-sociales"><a href="https://instagram.com/${igUser}" target="_blank" class="btn-social btn-ig">Ver Instagram</a></div>`;
                }

                const tarjetaHTML = `
                    <article class="tarjeta-servicio">
                        <div class="categoria-tag">${data.categoria}</div>
                        <h2>${data.nombre}</h2>
                        
                        ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                        
                        <p class="descripcion">${data.descripcion}</p>
                        
                        <div class="info-extra">
                            <span>📍 ${data.ubicacion || 'A convenir'}</span>
                            <span class="badge badge-green">${pagosText}</span>
                        </div>
                        
                        ${redesHTML}
                        <a href="https://wa.me/${waNumero}?text=Hola,%20vi%20tu%20perfil%20en%20el%20directorio%20de%20Santa%20Ana" target="_blank" class="btn-whatsapp">
                            Contactar por WhatsApp
                        </a>
                    </article>
                `;
                listaServicios.innerHTML += tarjetaHTML;
            });

            activarBuscador();
            
        } catch (error) { listaServicios.innerHTML = "<p style='color: red;'>Error de conexión.</p>"; }
    }

    function activarBuscador() {
        document.getElementById('buscador').addEventListener('input', (e) => {
            const textoBusqueda = e.target.value.toLowerCase();
            document.querySelectorAll('.tarjeta-servicio').forEach(tarjeta => {
                const contenido = tarjeta.innerText.toLowerCase();
                tarjeta.style.display = contenido.includes(textoBusqueda) ? 'flex' : 'none';
            });
        });
    }

    cargarServicios();
}