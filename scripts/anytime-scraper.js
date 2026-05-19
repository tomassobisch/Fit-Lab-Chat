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

    // 2. NAVEGAR DIRECTO A LISTA DE SOCIOS
    console.log('Navegando a la lista de alumnos...');
    await page.goto('https://coach-v2.anytimefitness.com/clients', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(10000); 
    await page.screenshot({ path: 'debug-clients-page.png', fullPage: true });

    // Debug: Listar elementos que contienen nombres conocidos o palabras clave
    const debugInfo = await page.evaluate(() => {
      const allText = document.body.innerText;
      const sampleElements = Array.from(document.querySelectorAll('div, li, span'))
        .filter(el => el.innerText && el.innerText.length > 5 && el.innerText.length < 100)
        .slice(0, 20)
        .map(el => ({ tag: el.tagName, class: el.className, text: el.innerText }));
      return { length: allText.length, samples: sampleElements };
    });
    console.log('Debug /clients:', JSON.stringify(debugInfo, null, 2));

    // 3. BARRIDO COMPLETO (SCROLL)
    console.log('Iniciando barrido de 148 alumnos...');
    const auditoriaAcumulada = { escaneados: new Set(), pendientes: new Set(), nombresVistos: new Set() };
    
    let scrollAttempts = 0;
    while (scrollAttempts < 50) {
      const data = await page.evaluate(() => {
        // Buscamos elementos que parezcan tarjetas de alumnos (avatar + texto)
        const cards = Array.from(document.querySelectorAll('div, li')).filter(el => {
          return el.querySelector('img') && el.innerText.length > 10 && el.innerText.length < 300;
        });
        
        return cards.map(el => {
          const text = el.innerText;
          const name = text.split('\n')[0].trim();
          const hasScan = text.toLowerCase().includes('scan') && (text.toLowerCase().includes('may') || text.toLowerCase().includes('05/'));
          return { name, hasScan };
        }).filter(d => d.name.length > 4 && !d.name.includes('Envía') && !d.name.includes('Mostrando'));
      });

      data.forEach(d => {
        if (!auditoriaAcumulada.nombresVistos.has(d.name)) {
          auditoriaAcumulada.nombresVistos.add(d.name);
          if (d.hasScan) auditoriaAcumulada.escaneados.add(d.name);
          else auditoriaAcumulada.pendientes.add(d.name);
        }
      });

      console.log(`Analizados: ${auditoriaAcumulada.nombresVistos.size} alumnos...`);
      if (auditoriaAcumulada.nombresVistos.size >= 148) break;

      // Scroll en el contenedor de la lista o general
      await page.evaluate(() => {
        const list = document.querySelector('.infinite-scroll-component') || window;
        list.scrollBy(0, 1000);
      });
      await page.waitForTimeout(1000);
      scrollAttempts++;
    }

    // 4. CONSOLIDAR Y ENVIAR
    const alertas = [];
    alertas.push(`📊 TOTAL AF: Tienes ${auditoriaAcumulada.nombresVistos.size} alumnos identificados.`);
    
    const listaEscaneados = Array.from(auditoriaAcumulada.escaneados);
    const listaPendientes = Array.from(auditoriaAcumulada.pendientes);

    if (listaEscaneados.length > 0) {
      alertas.push(`✅ ESCANEADOS ESTE MES (${listaEscaneados.length}): ${listaEscaneados.slice(0, 5).join(', ')}...`);
    }
    if (listaPendientes.length > 0) {
      alertas.push(`❌ PENDIENTES DE ESCANEO (${listaPendientes.length}): ${listaPendientes.slice(0, 10).join(', ')}...`);
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

    console.log('Reporte enviado con éxito.');

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

checkAnytimeDashboard();
