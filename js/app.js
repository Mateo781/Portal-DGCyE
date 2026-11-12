// Estado global de la aplicación
const AppState = {
  normativas: [],
  filtros: {
    texto: '',
    tipo: 'todos',
    anio: 'todos',
    mes: 'todos',
    fechaExacta: null
  },
  calendario: {
    anio: 2026,
    mes: 10 // 0 = Enero, 10 = Noviembre
  }
};

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Elementos del DOM
const DOM = {
  buscador: document.getElementById('buscador'),
  btnLimpiarBusqueda: document.getElementById('btn-limpiar-busqueda'),
  btnTipoToggle: document.getElementById('btn-tipo-toggle'),
  menuTipo: document.getElementById('menu-tipo'),
  labelTipoSeleccionado: document.getElementById('label-tipo-seleccionado'),

  calendarWrapper: document.getElementById('calendar-wrapper'),
  btnCalendarToggle: document.getElementById('btn-calendar-toggle'),
  calendarPopover: document.getElementById('calendar-popover'),
  calMonthTitle: document.getElementById('cal-month-title'),
  calDaysGrid: document.getElementById('calendar-days-grid'),
  calBtnPrev: document.getElementById('cal-btn-prev'),
  calBtnNext: document.getElementById('cal-btn-next'),
  btnLimpiarFecha: document.getElementById('btn-limpiar-fecha'),

  calInputDia: document.getElementById('cal-input-dia'),
  calInputMes: document.getElementById('cal-input-mes'),
  calInputAnio: document.getElementById('cal-input-anio'),

  activeChips: document.getElementById('active-chips'),
  metricTime: document.getElementById('metric-time'),
  resultsCount: document.getElementById('results-count'),
  contenedorResultados: document.getElementById('contenedor-resultados'),
  toast: document.getElementById('toast')
};

// ==========================================================================
// 1. CARGA DE DATOS (JSON con fallback a memoria RAM)
// ==========================================================================
async function inicializarDatos() {
  try {
    // Intenta consumir el archivo JSON oficial
    const response = await fetch('data/normativas.json');
    if (!response.ok) throw new Error('No se pudo cargar el archivo data/normativas.json');
    AppState.normativas = await response.json();
    console.log(`✅ [DGCyE] Se cargaron ${AppState.normativas.length} registros desde data/normativas.json`);
  } catch (err) {
    // Si corre por file:// y el navegador bloquea fetch() por CORS, usamos el respaldo en RAM
    console.warn('⚠️ [DGCyE] Usando base de datos en RAM (fallback local):', err.message);
    AppState.normativas = (typeof baseDatosNormativasFallback !== 'undefined')
      ? baseDatosNormativasFallback
      : [];
  }

  // Inicializar componentes visuales
  renderizarCalendario();
  ejecutarFiltrado();
}

// ==========================================================================
// 2. MOTOR DE FILTRADO EN TIEMPO REAL (Lógica O(n) - RNF-01)
// ==========================================================================
function ejecutarFiltrado() {
  const tInicio = performance.now(); // Cronómetro de precisión

  const textoBusqueda = AppState.filtros.texto.trim().toLowerCase();
  const tipoFiltro = AppState.filtros.tipo;
  const fechaFiltro = AppState.filtros.fechaExacta;
  const mesFiltro = AppState.filtros.mes;
  const anioFiltro = AppState.filtros.anio;

  // Filtrado funcional en memoria RAM
  const resultados = AppState.normativas.filter(item => {
    // 1. Coincidencia por texto (Número, Tipo o Descripción de la norma)
    const coincideTexto = !textoBusqueda ||
      item.nro.toLowerCase().includes(textoBusqueda) ||
      item.tipo.toLowerCase().includes(textoBusqueda) ||
      item.desc.toLowerCase().includes(textoBusqueda) ||
      (item.anexos && item.anexos.some(a => a.nombre.toLowerCase().includes(textoBusqueda)));

    // 2. Coincidencia por Tipo de norma
    const coincideTipo = (tipoFiltro === 'todos') || (item.tipo === tipoFiltro);

    // 3. Coincidencia por Fecha exacta
    let coincideFecha = true;
    if (fechaFiltro) {
      coincideFecha = item.fecha === fechaFiltro;
    } else {
      // Coincidencia por año si está seleccionado
      if (anioFiltro !== 'todos') {
        coincideFecha = coincideFecha && (item.anio === Number(anioFiltro));
      }
      // Coincidencia por mes si está seleccionado
      if (mesFiltro !== 'todos') {
        coincideFecha = coincideFecha && (item.mes.toLowerCase() === mesFiltro.toLowerCase());
      }
    }

    return coincideTexto && coincideTipo && coincideFecha;
  });

  const tFin = performance.now();
  const tiempoTranscurrido = (tFin - tInicio).toFixed(2);

  // Actualizar métrica en pantalla para evidenciar cumplimiento de RNF-01 (< 100 ms)
  DOM.metricTime.textContent = `${tiempoTranscurrido} ms`;

  // Renderizar tarjetas resultantes
  renderizarTarjetas(resultados);
  renderizarChipsFiltros();
}

// ==========================================================================
// 3. RENDERIZADO DE RESULTADOS (DOM Dinámico - Idéntico a Boceto.png)
// ==========================================================================
function renderizarTarjetas(lista) {
  DOM.resultsCount.textContent = `Mostrando ${lista.length} de ${AppState.normativas.length} normativas institucionales`;

  if (lista.length === 0) {
    DOM.contenedorResultados.innerHTML = `
      <div class="empty-state-card">
        <h3>🔍 No se encontraron normativas coincidentes</h3>
        <p>No hay resoluciones, disposiciones o circulares que cumplan los criterios seleccionados.</p>
        <button type="button" class="btn-reset-filters" onclick="resetearTodosLosFiltros()">Limpiar todos los filtros</button>
      </div>
    `;
    return;
  }

  // Generación de tarjetas idénticas al diseño del boceto
  DOM.contenedorResultados.innerHTML = lista.map(item => {
    const anexosCount = item.anexos ? item.anexos.length : 0;
    const fechaLegible = `${item.mes} ${item.anio}`;

    const anexosHtml = (item.anexos && item.anexos.length > 0)
      ? item.anexos.map(anexo => `
          <div class="annex-item">
            <div class="annex-info">
              <span class="annex-icon">${anexo.formato === 'xlsx' ? '📊' : '📄'}</span>
              <span class="annex-name" title="${anexo.nombre}">${anexo.nombre}</span>
              ${anexo.tamano ? `<span class="annex-size">(${anexo.tamano})</span>` : ''}
            </div>
            <button 
              type="button" 
              class="btn-download-annex" 
              title="Descargar ${anexo.nombre}" 
              onclick="descargarAnexo('${anexo.nombre}', '${item.nro}')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        `).join('')
      : `<p style="font-size: 0.75rem; color: #94a3b8; font-style: italic;">Sin archivos adjuntos</p>`;

    return `
      <article class="normativa-card" data-id="${item.id}">
        <div>
          <div class="card-header-row">
            <span class="card-badge">${item.tipo}</span>
            <span class="card-date">${fechaLegible}</span>
          </div>

          <h3 class="card-title">N.° ${item.nro}</h3>
          <p class="card-desc">${item.desc}</p>
        </div>

        <div class="card-annexes">
          <button type="button" class="btn-annexes-toggle" onclick="toggleAnexos(${item.id})">
            <div class="annexes-badge-content">
              <span>📎</span>
              <span>Anexos (${anexosCount})</span>
            </div>
            <span class="chevron-icon" id="chevron-${item.id}">▼</span>
          </button>
          <div class="annexes-list" id="anexos-list-${item.id}">
            ${anexosHtml}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ==========================================================================
// 4. CALENDARIO INTERACTIVO (RF-02 - Diseño de Boceto.png)
// ==========================================================================
function renderizarCalendario() {
  const anio = AppState.calendario.anio;
  const mes = AppState.calendario.mes;

  DOM.calMonthTitle.textContent = `${NOMBRES_MESES[mes]} de ${anio}`;

  // Primer día de la semana del mes (0 = Domingo)
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  // Cantidad de días en el mes
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  // Fechas con normativas para destacar en el calendario
  const fechasConNormativas = new Set(
    AppState.normativas.map(n => n.fecha)
  );

  let htmlDias = '';

  // Celdas vacías antes del primer día
  for (let i = 0; i < primerDiaSemana; i++) {
    htmlDias += `<div class="cal-day-cell empty"></div>`;
  }

  // Celdas para cada día del mes
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const diaStr = String(dia).padStart(2, '0');
    const mesStr = String(mes + 1).padStart(2, '0');
    const fechaISO = `${anio}-${mesStr}-${diaStr}`;

    const tieneNormativa = fechasConNormativas.has(fechaISO);
    const estaSeleccionado = AppState.filtros.fechaExacta === fechaISO;

    let clases = 'cal-day-cell';
    if (tieneNormativa) clases += ' has-events';
    if (estaSeleccionado) clases += ' selected';

    htmlDias += `
      <div 
        class="${clases}" 
        data-fecha="${fechaISO}" 
        title="${tieneNormativa ? 'Hay normativas registradas en esta fecha' : ''}"
        onclick="seleccionarFechaCalendario('${fechaISO}')">
        ${dia}
      </div>
    `;
  }

  DOM.calDaysGrid.innerHTML = htmlDias;
}

function cambiarMesCalendario(delta) {
  let nuevoMes = AppState.calendario.mes + delta;
  let nuevoAnio = AppState.calendario.anio;

  if (nuevoMes < 0) {
    nuevoMes = 11;
    nuevoAnio--;
  } else if (nuevoMes > 11) {
    nuevoMes = 0;
    nuevoAnio++;
  }

  AppState.calendario.mes = nuevoMes;
  AppState.calendario.anio = nuevoAnio;

  renderizarCalendario();
}

function seleccionarFechaCalendario(fechaISO) {
  if (AppState.filtros.fechaExacta === fechaISO) {
    // Si ya estaba seleccionada, la desmarca
    AppState.filtros.fechaExacta = null;
  } else {
    AppState.filtros.fechaExacta = fechaISO;

    // Sincronizar inputs rápidos
    const [a, m, d] = fechaISO.split('-');
    if (DOM.calInputDia) DOM.calInputDia.value = Number(d);
    if (DOM.calInputMes) DOM.calInputMes.value = Number(m);
    if (DOM.calInputAnio) DOM.calInputAnio.value = Number(a);
  }

  renderizarCalendario();
  ejecutarFiltrado();
}

function limpiarFiltroFecha() {
  AppState.filtros.fechaExacta = null;
  AppState.filtros.anio = 'todos';
  AppState.filtros.mes = 'todos';

  if (DOM.calInputDia) DOM.calInputDia.value = '';
  if (DOM.calInputMes) DOM.calInputMes.value = '';
  if (DOM.calInputAnio) DOM.calInputAnio.value = '';

  renderizarCalendario();
  ejecutarFiltrado();
}

// ==========================================================================
// 5. CHIPS DE FILTROS ACTIVOS Y RESET
// ==========================================================================
function renderizarChipsFiltros() {
  const chips = [];

  if (AppState.filtros.texto) {
    chips.push({
      label: `Texto: "${AppState.filtros.texto}"`,
      clear: () => {
        AppState.filtros.texto = '';
        DOM.buscador.value = '';
        DOM.btnLimpiarBusqueda.classList.add('hidden');
        ejecutarFiltrado();
      }
    });
  }

  if (AppState.filtros.tipo !== 'todos') {
    chips.push({
      label: `Tipo: ${AppState.filtros.tipo}`,
      clear: () => {
        seleccionarTipo('todos');
      }
    });
  }

  if (AppState.filtros.fechaExacta) {
    chips.push({
      label: `Fecha: ${AppState.filtros.fechaExacta}`,
      clear: () => {
        limpiarFiltroFecha();
      }
    });
  }

  DOM.activeChips.innerHTML = chips.map((c, i) => `
    <span class="filter-chip">
      ${c.label}
      <button type="button" onclick="eliminarChip(${i})" aria-label="Quitar filtro">&times;</button>
    </span>
  `).join('');

  // Guardar handlers para los botones de chip
  window._chipsHandlers = chips.map(c => c.clear);
}

function eliminarChip(indice) {
  if (window._chipsHandlers && window._chipsHandlers[indice]) {
    window._chipsHandlers[indice]();
  }
}

function resetearTodosLosFiltros() {
  AppState.filtros.texto = '';
  DOM.buscador.value = '';
  DOM.btnLimpiarBusqueda.classList.add('hidden');

  seleccionarTipo('todos');
  limpiarFiltroFecha();
}

// ==========================================================================
// 6. CONTROLADORES DE EVENTOS
// ==========================================================================
function seleccionarTipo(tipo) {
  AppState.filtros.tipo = tipo;
  DOM.labelTipoSeleccionado.textContent = tipo === 'todos' ? 'Tipo de documento' : tipo;

  // Actualizar clase activa en el menú
  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tipo === tipo);
  });

  DOM.menuTipo.classList.remove('show');
  DOM.btnTipoToggle.setAttribute('aria-expanded', 'false');

  ejecutarFiltrado();
}

// Acordeón / Visor de Anexos
function toggleAnexos(id) {
  const lista = document.getElementById(`anexos-list-${id}`);
  const chevron = document.getElementById(`chevron-${id}`);
  if (!lista) return;

  const estaOculto = window.getComputedStyle(lista).display === 'none';
  lista.style.display = estaOculto ? 'flex' : 'none';
  if (chevron) {
    chevron.textContent = estaOculto ? '▲' : '▼';
  }
}

// Descarga simulada de archivos oficiales
function descargarAnexo(nombreArchivo, nroNorma) {
  mostrarToast(`📥 Descargando anexo oficial: ${nombreArchivo} (${nroNorma})`);
}

// Notificación Toast
let toastTimeout;
function mostrarToast(mensaje) {
  DOM.toast.textContent = mensaje;
  DOM.toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 3500);
}

// ==========================================================================
// 7. LISTENERS Y REGISTRO DE EVENTOS
// ==========================================================================
function registrarEventListeners() {
  // Input del Buscador (Tiempo Real)
  DOM.buscador.addEventListener('input', (e) => {
    AppState.filtros.texto = e.target.value;
    DOM.btnLimpiarBusqueda.classList.toggle('hidden', e.target.value.length === 0);
    ejecutarFiltrado();
  });

  // Limpiar buscador
  DOM.btnLimpiarBusqueda.addEventListener('click', () => {
    AppState.filtros.texto = '';
    DOM.buscador.value = '';
    DOM.btnLimpiarBusqueda.classList.add('hidden');
    DOM.buscador.focus();
    ejecutarFiltrado();
  });

  // Toggle menú tipo de documento
  DOM.btnTipoToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const esVisible = DOM.menuTipo.classList.toggle('show');
    DOM.btnTipoToggle.setAttribute('aria-expanded', String(esVisible));
    DOM.calendarPopover.classList.remove('show');
    DOM.btnCalendarToggle.setAttribute('aria-expanded', 'false');
  });

  // Selección de tipo en el dropdown
  DOM.menuTipo.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    seleccionarTipo(item.dataset.tipo);
  });

  // Toggle menú calendario
  DOM.btnCalendarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const esVisible = DOM.calendarPopover.classList.toggle('show');
    DOM.btnCalendarToggle.setAttribute('aria-expanded', String(esVisible));
    DOM.menuTipo.classList.remove('show');
    DOM.btnTipoToggle.setAttribute('aria-expanded', 'false');
  });

  // Botones de navegación de mes
  DOM.calBtnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    cambiarMesCalendario(-1);
  });

  DOM.calBtnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    cambiarMesCalendario(1);
  });

  // Botón limpiar fecha
  DOM.btnLimpiarFecha.addEventListener('click', (e) => {
    e.stopPropagation();
    limpiarFiltroFecha();
  });

  // Inputs directos de DD / MM / AAAA en el calendario
  const actualizarPorInputsDirectos = () => {
    const d = DOM.calInputDia.value;
    const m = DOM.calInputMes.value;
    const a = DOM.calInputAnio.value;

    if (d && m && a) {
      const diaPad = String(d).padStart(2, '0');
      const mesPad = String(m).padStart(2, '0');
      seleccionarFechaCalendario(`${a}-${mesPad}-${diaPad}`);
    }
  };

  DOM.calInputDia.addEventListener('input', actualizarPorInputsDirectos);
  DOM.calInputMes.addEventListener('input', actualizarPorInputsDirectos);
  DOM.calInputAnio.addEventListener('input', actualizarPorInputsDirectos);

  // Evitar que clicks dentro del calendario cierren el popover
  DOM.calendarPopover.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Cerrar popovers al hacer click afuera
  document.addEventListener('click', () => {
    DOM.menuTipo.classList.remove('show');
    DOM.btnTipoToggle.setAttribute('aria-expanded', 'false');
    DOM.calendarPopover.classList.remove('show');
    DOM.btnCalendarToggle.setAttribute('aria-expanded', 'false');
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      DOM.menuTipo.classList.remove('show');
      DOM.btnTipoToggle.setAttribute('aria-expanded', 'false');
      DOM.calendarPopover.classList.remove('show');
      DOM.btnCalendarToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  registrarEventListeners();
  inicializarDatos();
});

