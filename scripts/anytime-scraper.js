import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Conexión directa con tu base de datos de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnytimeDashboard() {
  // Lanzamos el navegador en modo invisible (headless)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('Abriendo el Coach Dashboard v2...');
    // Vamos directo a la URL de tu sede
    await page.goto('https://coach-v2.anytimefitness.com/home/SP-0085', { 
      waitUntil: 'networkidle' 
    });

    // 1. DETECTAR SI PIDE LOGIN
    if (page.url().includes('login') || (await page.getByText('Log into Dashboard').isVisible())) {
      console.log('Detectada pantalla de Login o inicio. Iniciando protocolo blindado...');

      // Si vemos el botón "Log into Dashboard", hacemos clic en él
      const loginButton = page.getByText('Log into Dashboard');
      if (await loginButton.isVisible()) {
        console.log('Haciendo clic en "Log into Dashboard"...');
        await loginButton.click();
        await page.waitForLoadState('networkidle');
      }
      
      const email = process.env.ANYTIME_EMAIL;
      const password = process.env.ANYTIME_PASSWORD;

      if (!email || !password) {
        console.error('ERROR: ANYTIME_EMAIL and ANYTIME_PASSWORD must be set in .env');
        await browser.close();
        return;
      }

      // 1. Esperar y rellenar usuario con foco directo
      await page.waitForSelector('input[type="email"], input[name="username"], #username', { state: 'visible', timeout: 15000 });
      await page.focus('input[type="email"], input[name="username"], #username');
      await page.locator('input[type="email"], input[name="username"], #username').first().fill(email);
      
      // 2. Esperar y rellenar contraseña
      await page.waitForSelector('input[type="password"], #password', { state: 'visible', timeout: 15000 });
      await page.focus('input[type="password"], #password');
      await page.locator('input[type="password"], #password').first().fill(password);
      
      console.log('Credenciales introducidas. Disparando formulario vía teclado (Enter)...');
      
      // 3. Enviar sin hacer clic físico (truco del Enter para máxima compatibilidad)
      await page.keyboard.press('Enter');
      
      // 4. Esperar a que la URL cambie al home confirmando el éxito
      await page.waitForURL('**/home**', { waitUntil: 'load', timeout: 60000 });
      console.log('Login exitoso y verificado.');
    }

    console.log('Dentro del Dashboard de Anytime. Esperando carga de datos...');
    await page.waitForTimeout(10000); // Esperar 10 segundos para que cargue el dashboard
    await page.screenshot({ path: 'debug-dashboard-loaded.png', fullPage: true });

    // Intentar hacer clic en "Socios" si estamos en el home y no vemos la lista
    const sociosButton = page.locator('a[href="/clients"]').first();
    if (await sociosButton.isVisible()) {
      console.log('Haciendo clic en "Socios"...');
      await sociosButton.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'debug-socios-page.png', fullPage: true });
    }


    // --- 1. LEER SUGERENCIAS Y TOTAL DE ALUMNOS ---
    console.log('Leyendo datos del dashboard...');
    const datosDashboard = await page.evaluate(() => {
      // 1. Contador de alumnos (ej: "Mostrando 25 de 148 alumnos")
      const contadorTexto = document.querySelector('.infinite-scroll-component')?.parentElement?.previousElementSibling?.innerText || '';
      const matchAlumnos = contadorTexto.match(/de (\d+) alumnos/i);
      const totalAlumnos = matchAlumnos ? matchAlumnos[1] : null;

      // 2. Sugerencias de coaching con intento de extracción de nombres
      const sugerenciasResult = [];
      // Buscamos los contenedores que suelen agrupar la foto/nombre con la sugerencia
      const contenedoresSugerencia = Array.from(document.querySelectorAll('div')).filter(div => {
        return div.innerText.includes('Envía al socio') || div.innerText.includes('programar un escáner');
      });

      contenedoresSugerencia.forEach(cont => {
        const textoCompleto = cont.innerText.trim();
        const lineas = textoCompleto.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        
        // Intentamos encontrar el nombre: suele estar en un elemento anterior o ser la primera línea si el contenedor es grande
        // En la captura, el nombre parece estar en un elemento hermano o superior al texto de la alerta
        let nombreCercano = '';
        
        // Estrategia: buscar el elemento de texto más cercano que parezca un nombre (sin verbos de acción)
        const palabrasAccion = ['envía', 'programar', 'hace', 'socio', 'seguimiento'];
        const posibleNombre = lineas.find(l => !palabrasAccion.some(p => l.toLowerCase().includes(p)) && l.length > 3 && l.length < 30);
        
        if (posibleNombre) nombreCercano = posibleNombre;

        const textoAlerta = lineas.find(l => l.includes('Envía') || l.includes('programar')) || '';
        const tiempo = lineas.find(l => l.includes('hace') || l.includes('hora')) || '';

        if (textoAlerta) {
          sugerenciasResult.push({
            texto: nombreCercano ? `Para ${nombreCercano}: ${textoAlerta}` : textoAlerta,
            tiempo: tiempo,
            esRelevante: true
          });
        }
      });
      
      return { totalAlumnos, sugerenciasSugeridas: sugerenciasResult };
    });

    // --- 2. AUDITORÍA DETALLADA DE SOCIOS (ESCANEOS Y ENTRENOS) ---
    console.log('Iniciando barrido completo de alumnos (Estrategia Agresiva)...');
    
    const auditoriaAcumulada = {
      escaneados: new Set(),
      pendientes: new Set(),
      nombresVistos: new Set()
    };

    let scrollAttempts = 0;
    const maxScrollAttempts = 80; // Más intentos para asegurar los 148

    while (scrollAttempts < maxScrollAttempts) {
      const datosPagina = await page.evaluate(() => {
        // Buscamos cualquier elemento que parezca una "tarjeta" de alumno
        // Criterio: Tiene un nombre y subtexto de actividad (Completed, Scan, etc.)
        const todos = Array.from(document.querySelectorAll('div, li'));
        const tarjetas = todos.filter(el => {
          const text = el.innerText || '';
          return text.length > 5 && text.length < 300 && 
                 (text.includes('Completed') || text.includes('Scan') || text.includes('ayer') || text.includes('hoy') || text.includes('mañana'));
        });

        return tarjetas.map(el => {
          const lines = el.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 1);
          const nombre = lines[0] || '';
          const fullText = el.innerText.toLowerCase();
          const tieneEscaneo = fullText.includes('scan') && (fullText.includes('may') || fullText.includes('05/'));
          return { nombre, tieneEscaneo };
        }).filter(d => d.nombre.length > 3 && !d.nombre.includes('Envía') && !d.nombre.includes('programar'));
      });

      let nuevos = 0;
      datosPagina.forEach(d => {
        if (!auditoriaAcumulada.nombresVistos.has(d.nombre)) {
          auditoriaAcumulada.nombresVistos.add(d.nombre);
          if (d.tieneEscaneo) auditoriaAcumulada.escaneados.add(d.nombre);
          else auditoriaAcumulada.pendientes.add(d.nombre);
          nuevos++;
        }
      });

      console.log(`Progreso: ${auditoriaAcumulada.nombresVistos.size} / 148 alumnos. (+${nuevos} nuevos)`);

      if (auditoriaAcumulada.nombresVistos.size >= 148) break;

      // Scroll inteligente: Buscamos el contenedor que tiene el texto de alumnos
      await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('div')).filter(el => el.scrollHeight > el.clientHeight);
        // El de la lista suele ser el que tiene el texto "Mostrando" cerca o dentro
        const listContainer = containers.find(el => el.innerText.includes('alumnos')) || document.querySelector('.infinite-scroll-component');
        
        if (listContainer) {
          listContainer.scrollBy(0, 600);
        } else {
          window.scrollBy(0, 600);
        }
      });

      await page.waitForTimeout(600);
      scrollAttempts++;
      
      // Si llevamos 15 intentos sin ver a nadie, intentamos un scroll más brusco
      if (scrollAttempts % 15 === 0 && nuevos === 0) {
        console.log('Scroll estancado, intentando scroll de ratón...');
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(1000);
      }
    }

    const auditoriaEscaneos = {
      escaneados: Array.from(auditoriaAcumulada.escaneados),
      pendientes: Array.from(auditoriaAcumulada.pendientes)
    };

    console.log(`Barrido finalizado. Total analizados: ${auditoriaEscaneos.escaneados.length + auditoriaEscaneos.pendientes.length}`);

    // --- 2. LEER MENSAJES PENDIENTES ---
    console.log('Verificando mensajes de alumnos...');
    const alertasMensajes = await page.evaluate(() => {
      const badgeTotal = document.querySelector('.sidebar__item .badge, .sidebar__link .badge')?.innerText?.trim();
      const resultados = [];
      if (badgeTotal && parseInt(badgeTotal) > 0) {
        resultados.push({ texto: `Tienes ${badgeTotal} mensajes pendientes en el chat.` });
      }
      return resultados;
    });

    // --- 3. CONSOLIDAR ALERTAS ---
    const todasLasAlertas = [];
    
    if (datosDashboard.totalAlumnos) {
      todasLasAlertas.push(`📊 TOTAL AF: Tienes ${datosDashboard.totalAlumnos} alumnos registrados.`);
    }

    // Reporte de Escaneos
    if (auditoriaEscaneos.escaneados.length > 0) {
      todasLasAlertas.push(`✅ ESCANEADOS ESTE MES (${auditoriaEscaneos.escaneados.length}): ${auditoriaEscaneos.escaneados.slice(0, 10).join(', ')}${auditoriaEscaneos.escaneados.length > 10 ? '...' : ''}`);
    }
    
    if (auditoriaEscaneos.pendientes.length > 0) {
      // Priorizamos mostrar quiénes faltan
      todasLasAlertas.push(`❌ PENDIENTES DE ESCANEO (${auditoriaEscaneos.pendientes.length}): ${auditoriaEscaneos.pendientes.slice(0, 15).join(', ')}...`);
    }

    datosDashboard.sugerenciasSugeridas.forEach(a => {
      // Filtrar para asegurar que solo enviamos sugerencias reales de coaching
      const textoLow = a.texto.toLowerCase();
      if (textoLow.includes('socio') || textoLow.includes('escáner') || textoLow.includes('seguimiento') || textoLow.includes('entren')) {
        let msg = a.texto;
        if (a.tiempo) msg += ` (${a.tiempo})`;
        todasLasAlertas.push(msg);
      }
    });

    alertasMensajes.forEach(a => todasLasAlertas.push(a.texto));

    // --- 4. INSERTAR EN SUPABASE ---
    console.log(`Auditoría finalizada. ${todasLasAlertas.length} alertas generadas.`);

    // Asegurarnos de que existe el agente "Auditor Nocturno"
    const { data: agente } = await supabase
      .from('tj_agentes')
      .upsert({ 
        nombre: 'Auditor Nocturno Anytime', 
        nickname: 'AuditorAnytime', 
        rol: 'Analista de Rendimiento',
        skills: 'Auditoría, Cumplimiento, Mensajería',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=auditor'
      }, { onConflict: 'nickname' })
      .select()
      .single();

    for (const texto of todasLasAlertas) {
      console.log(`Insertando alerta: ${texto}`);
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'agente',
        remitente_id: agente.id,
        texto: `📌 REPORTE NOCTURNO: ${texto}`,
        canal: '#alertas',
        estado_procesado: false
      }]);
    }

    console.log('Reporte nocturno enviado con éxito.');

    console.log('Sincronización finalizada con éxito.');

  } catch (error) {
    console.error('Error ejecutando el scraping automatizado:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('Captura de pantalla de error guardada como error-screenshot.png');
  } finally {
    await browser.close();
  }
}

checkAnytimeDashboard();
