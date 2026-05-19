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
      
      // 4. Esperar a que la URL cambie al home de tu sede confirmando el éxito
      await page.waitForURL('**/home/SP-0085', { waitUntil: 'networkidle', timeout: 45000 });
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

      // 2. Sugerencias de coaching
      const sugerencias = Array.from(document.querySelectorAll('div')).filter(div => {
        const text = div.innerText;
        return text.includes('escáner') || text.includes('seguimiento') || text.includes('entrenamiento');
      });
      
      const sugerenciasResult = [];
      const textosVistos = new Set();
      for (const sug of sugerencias) {
        const lineas = sug.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        if (lineas.length > 0) {
          const textoPrincipal = lineas[0];
          if (!textosVistos.has(textoPrincipal)) {
            textosVistos.add(textoPrincipal);
            sugerenciasResult.push({
              texto: textoPrincipal,
              tiempo: lineas.find(l => l.includes('hace') || l.includes('hora') || l.includes('día')) || ''
            });
          }
        }
      }
      return { totalAlumnos, sugerenciasSugeridas: sugerenciasResult };
    });

    // --- 2. LEER MENSAJES PENDIENTES ---
    // ... (sin cambios)

    // --- 3. CONSOLIDAR ALERTAS ---
    const todasLasAlertas = [];
    
    if (datosDashboard.totalAlumnos) {
      todasLasAlertas.push(`Total de alumnos registrados en AF: ${datosDashboard.totalAlumnos}`);
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
