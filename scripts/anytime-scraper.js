import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnytimeDashboard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();

  try {
    console.log('Abriendo Anytime Fitness Dashboard...');
    await page.goto('https://coach-v2.anytimefitness.com/home/SP-0085', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000); // Espera inicial para renderizado

    // 1. GESTIÓN DE LOGIN Y SPLASH SCREEN
    const needsLogin = async () => {
      return (await page.getByText('Log into Dashboard').isVisible()) || 
             (await page.getByText('USERNAME (EMAIL)').isVisible()) ||
             page.url().includes('login');
    };

    if (await needsLogin()) {
      console.log('Sesión no activa. Iniciando protocolo de acceso...');
      
      // Si estamos en la pantalla de bienvenida, clic en el botón
      const splashButton = page.getByText('Log into Dashboard');
      if (await splashButton.isVisible()) {
        console.log('Superando pantalla de bienvenida...');
        await splashButton.click();
        await page.waitForTimeout(5000);
      }

      // Rellenar credenciales si aparecen
      const email = process.env.ANYTIME_EMAIL;
      const password = process.env.ANYTIME_PASSWORD;

      if (await page.locator('input[type="email"], input[name="username"], #username').isVisible()) {
        console.log('Rellenando credenciales...');
        await page.locator('input[type="email"], input[name="username"], #username').first().fill(email);
        await page.locator('input[type="password"], #password').first().fill(password);
        await page.keyboard.press('Enter');
        await page.waitForURL('**/home**', { waitUntil: 'load', timeout: 60000 });
        console.log('Acceso completado.');
      }
    }

    console.log('Esperando carga completa del Dashboard...');
    await page.waitForTimeout(10000); 

    // --- 1. LEER SUGERENCIAS Y MENSAJES ---
    console.log('Extrayendo sugerencias y alertas de mensajes...');
    const extraData = await page.evaluate(() => {
      // 1. Mensajes pendientes (Badge en el sidebar)
      const badge = document.querySelector('.sidebar__item .badge, .sidebar__link .badge')?.innerText?.trim();
      const numMensajes = badge ? parseInt(badge) : 0;

      // 2. Sugerencias de coaching (Alumnos que no responden o necesitan seguimiento)
      const sugerencias = Array.from(document.querySelectorAll('div')).filter(div => {
        return div.innerText.includes('Envía al socio') || div.innerText.includes('programar un escáner');
      }).map(cont => {
        const lines = cont.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        // Intentar extraer el nombre (suele ser la primera línea que no es un verbo)
        const palabrasAccion = ['envía', 'programar', 'socio', 'seguimiento', 'hace', 'hora'];
        return lines.find(l => !palabrasAccion.some(p => l.toLowerCase().includes(p)) && l.length < 30) || 'Socio desconocido';
      });

      return { numMensajes, sugerencias: [...new Set(sugerencias)] };
    });

    // --- 2. BARRIDO DE ALUMNOS (SCROLL) ---
    console.log('Iniciando barrido de 148 alumnos...');
    const auditoria = { escaneados: new Set(), pendientes: new Set(), nombresVistos: new Set() };
    
    let scrollAttempts = 0;
    while (scrollAttempts < 60) {
      const data = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div, li')).filter(el => {
          return el.querySelector('img') && el.innerText.length > 5 && el.innerText.length < 300 && !el.innerText.includes('Mostrando');
        });
        
        return cards.map(el => {
          const text = el.innerText;
          const name = text.split('\n')[0].trim();
          const hasScan = text.toLowerCase().includes('scan') && (text.toLowerCase().includes('may') || text.toLowerCase().includes('05/'));
          return { name, hasScan };
        }).filter(d => d.name.length > 4);
      });

      data.forEach(d => {
        if (!auditoria.nombresVistos.has(d.name)) {
          auditoria.nombresVistos.add(d.name);
          if (d.hasScan) auditoria.escaneados.add(d.name);
          else auditoria.pendientes.add(d.name);
        }
      });

      if (auditoria.nombresVistos.size >= 148) break;

      // Scroll panel izquierdo
      await page.evaluate(() => {
        const sidebar = document.querySelector('.infinite-scroll-component') || 
                        Array.from(document.querySelectorAll('div')).find(el => el.innerText?.includes('alumnos') && el.scrollHeight > el.clientHeight);
        if (sidebar) sidebar.scrollBy(0, 1000);
        else window.scrollBy(0, 800);
      });

      await page.waitForTimeout(800);
      scrollAttempts++;
      if (scrollAttempts > 15 && data.length === 0) break;
    }

    // --- 3. CONSOLIDAR Y ENVIAR REPORTE ---
    console.log('Guardando reporte estructurado en la base de datos...');
    
    // Guardar en tabla estructurada para el Dashboard
    const { error: reportError } = await supabase.from('tj_reportes').insert([{
      total_alumnos: auditoria.nombresVistos.size,
      mensajes_pendientes: extraData.numMensajes,
      pendientes_escaneo: Array.from(auditoria.pendientes),
      sin_respuesta: extraData.sugerencias
    }]);

    if (reportError) console.error('Error guardando reporte estructurado:', reportError.message);

    const reportes = [];
    reportes.push(`📊 REPORTE SINCRONIZADO: ${auditoria.nombresVistos.size} alumnos procesados.`);
    
    const { data: agente } = await supabase.from('tj_agentes').upsert({ 
      nombre: 'Auditor Anytime', nickname: 'AuditorAnytime', rol: 'Analista de Rendimiento', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=auditor'
    }, { onConflict: 'nickname' }).select().single();

    for (const texto of reportes) {
      await supabase.from('tj_mensajes').insert([{
        remitente_tipo: 'agente', remitente_id: agente.id, texto: `📌 ${texto}`, canal: '#alertas', estado_procesado: false
      }]);
    }

    console.log(`Barrido finalizado: ${auditoria.nombresVistos.size} alumnos encontrados.`);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'error-final.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

checkAnytimeDashboard();
