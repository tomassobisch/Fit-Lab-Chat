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

    console.log('Dentro del Dashboard de Anytime. Iniciando auditoría completa...');

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
    console.log('Buscando la lista de alumnos en el panel lateral...');
    
    // El texto "Mostrando X de Y alumnos" es nuestro ancla
    const listAnchor = page.locator('text=/Mostrando/i');
    const scrollContainer = page.locator('.infinite-scroll-component, [class*="sidebar"], [class*="list"]').filter({ has: listAnchor }).first();

    const auditoriaAcumulada = {
      escaneados: new Set(),
      pendientes: new Set(),
      nombresVistos: new Set()
    };

    let scrollAttempts = 0;
    const maxScrollAttempts = 60; 

    while (scrollAttempts < maxScrollAttempts) {
      const datosPagina = await page.evaluate(() => {
        // Buscamos el contenedor de la lista de alumnos
        // Suele ser un div con scroll que contiene los nombres
        const items = Array.from(document.querySelectorAll('div, li')).filter(el => {
          // Buscamos elementos que tengan una imagen (avatar) y texto (nombre)
          const hasImg = el.querySelector('img');
          const text = el.innerText || '';
          return hasImg && text.length > 5 && text.length < 200 && 
                 !text.includes('Mostrando') && !text.includes('Tomas Sobisch');
        });
        
        return items.map(el => {
          const text = el.innerText || '';
          const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
          const nombre = lineas[0] || '';
          const textoLow = text.toLowerCase();
          const tieneEscaneoEsteMes = textoLow.includes('scan') && (textoLow.includes('may') || textoLow.includes('05/'));
          
          return { nombre, tieneEscaneoEsteMes };
        }).filter(d => d.nombre.length > 5);
      });

      datosPagina.forEach(d => {
        if (d.nombre && !auditoriaAcumulada.nombresVistos.has(d.nombre)) {
          auditoriaAcumulada.nombresVistos.add(d.nombre);
          if (d.tieneEscaneoEsteMes) {
            auditoriaAcumulada.escaneados.add(d.nombre);
          } else {
            auditoriaAcumulada.pendientes.add(d.nombre);
          }
        }
      });

      console.log(`Progreso: ${auditoriaAcumulada.nombresVistos.size} alumnos identificados...`);

      if (auditoriaAcumulada.nombresVistos.size >= 148) break;

      // Intentamos hacer scroll en el contenedor detectado o en el panel de la izquierda
      await page.evaluate(() => {
        const list = document.querySelector('.infinite-scroll-component') || 
                     Array.from(document.querySelectorAll('div')).find(el => el.innerText?.includes('Mostrando') && el.scrollHeight > el.clientHeight);
        if (list) {
           list.scrollBy(0, 800);
        } else {
           // Fallback: scroll en la posición de la lista
           window.scrollBy(0, 500);
        }
      });
      
      await page.waitForTimeout(1000);
      scrollAttempts++;
      
      // Si llevamos muchos intentos sin éxito, paramos
      if (scrollAttempts > 15 && auditoriaAcumulada.nombresVistos.size === 0) break;
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
