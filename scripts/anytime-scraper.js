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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();

  try {
    console.log('Iniciando sesión en Anytime Fitness...');
    await page.goto('https://coach-v2.anytimefitness.com/home/SP-0085', { waitUntil: 'load', timeout: 60000 });

    // 1. LOGIN PROTOCOLO BLINDADO
    if (page.url().includes('login') || (await page.getByText('Log into Dashboard').isVisible())) {
      const loginButton = page.getByText('Log into Dashboard');
      if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForLoadState('load');
      }
      
      const email = process.env.ANYTIME_EMAIL;
      const password = process.env.ANYTIME_PASSWORD;

      await page.waitForSelector('input[type="email"], input[name="username"], #username', { state: 'visible' });
      await page.locator('input[type="email"], input[name="username"], #username').first().fill(email);
      await page.waitForSelector('input[type="password"], #password', { state: 'visible' });
      await page.locator('input[type="password"], #password').first().fill(password);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/home**', { waitUntil: 'load', timeout: 60000 });
      console.log('Login exitoso.');
    }

    console.log('Dashboard cargado. Iniciando barrido desde la sidebar...');
    await page.waitForTimeout(8000); // Esperar a que la lista de alumnos cargue

    // 2. BARRIDO COMPLETO DESDE LA SIDEBAR (SCROLL ACUMULATIVO)
    const auditoriaAcumulada = { escaneados: new Set(), pendientes: new Set(), nombresVistos: new Set() };
    
    let scrollAttempts = 0;
    while (scrollAttempts < 60) {
      const data = await page.evaluate(() => {
        // En el home v2, los alumnos están en una lista a la izquierda con scroll infinito
        const items = Array.from(document.querySelectorAll('.infinite-scroll-component > div, [class*="athlete-list-item"]')).filter(el => {
          return el.innerText && el.innerText.length > 10 && el.innerText.length < 300;
        });
        
        return items.map(el => {
          const text = el.innerText;
          const name = text.split('\n')[0].trim();
          const hasScan = text.toLowerCase().includes('scan') && (text.toLowerCase().includes('may') || text.toLowerCase().includes('05/'));
          return { name, hasScan };
        }).filter(d => d.name.length > 4 && !d.name.includes('Envía') && !d.name.includes('Mostrando'));
      });

      let nuevosEnEsteScroll = 0;
      data.forEach(d => {
        if (!auditoriaAcumulada.nombresVistos.has(d.name)) {
          auditoriaAcumulada.nombresVistos.add(d.name);
          if (d.hasScan) auditoriaAcumulada.escaneados.add(d.name);
          else auditoriaAcumulada.pendientes.add(d.name);
          nuevosEnEsteScroll++;
        }
      });

      if (nuevosEnEsteScroll > 0) {
        console.log(`Progreso: ${auditoriaAcumulada.nombresVistos.size} alumnos identificados...`);
      }

      if (auditoriaAcumulada.nombresVistos.size >= 148) break;

      // Scroll solo en el panel de la izquierda
      await page.evaluate(() => {
        const sidebar = document.querySelector('.infinite-scroll-component') || 
                        Array.from(document.querySelectorAll('div')).find(el => el.innerText?.includes('alumnos') && el.scrollHeight > el.clientHeight);
        if (sidebar) {
          sidebar.scrollBy(0, 800);
        } else {
          window.scrollBy(0, 500);
        }
      });

      await page.waitForTimeout(600);
      scrollAttempts++;
      
      // Si llevamos muchos intentos sin ver nuevos, paramos (evitar bucle infinito si hay menos de 148)
      if (scrollAttempts > 20 && nuevosEnEsteScroll === 0 && auditoriaAcumulada.nombresVistos.size > 0) {
         console.log('No se detectan más alumnos nuevos. Finalizando barrido...');
         break;
      }
    }

    // 3. LEER MENSAJES Y SUGERENCIAS (FALLBACK)
    const datosExtra = await page.evaluate(() => {
       const sugerencias = Array.from(document.querySelectorAll('div')).filter(div => {
         return div.innerText.includes('Envía al socio') || div.innerText.includes('programar un escáner');
       }).map(el => el.innerText.split('\n')[0]).slice(0, 5);
       
       const badge = document.querySelector('.sidebar__item .badge, .sidebar__link .badge')?.innerText?.trim();
       return { sugerencias, badge };
    });

    // 4. CONSOLIDAR REPORTE
    const alertas = [];
    alertas.push(`📊 TOTAL AF: ${auditoriaAcumulada.nombresVistos.size} alumnos procesados.`);
    
    const listaEscaneados = Array.from(auditoriaAcumulada.escaneados);
    const listaPendientes = Array.from(auditoriaAcumulada.pendientes);

    if (listaEscaneados.length > 0) {
      alertas.push(`✅ ESCANEADOS ESTE MES (${listaEscaneados.length}): ${listaEscaneados.slice(0, 5).join(', ')}...`);
    }
    if (listaPendientes.length > 0) {
      alertas.push(`❌ PENDIENTES DE ESCANEO (${listaPendientes.length}): ${listaPendientes.slice(0, 10).join(', ')}...`);
    }
    if (datosExtra.badge && parseInt(datosExtra.badge) > 0) {
      alertas.push(`💬 CHATS: Tienes ${datosExtra.badge} notificaciones pendientes.`);
    }

    // Asegurar agente y enviar
    const { data: agente } = await supabase.from('tj_agentes').upsert({ 
      nombre: 'Auditor Nocturno Anytime', nickname: 'AuditorAnytime', rol: 'Analista', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=auditor'
    }, { onConflict: 'nickname' }).select().single();

    for (const texto of alertas) {
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'agente', remitente_id: agente.id, texto: `📌 REPORTE: ${texto}`, canal: '#alertas', estado_procesado: false
      }]);
    }

    console.log(`Barrido finalizado con ${auditoriaAcumulada.nombresVistos.size} alumnos.`);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

checkAnytimeDashboard();
