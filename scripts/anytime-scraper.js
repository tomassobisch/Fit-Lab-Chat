import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeFullStudentList() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();

  try {
    console.log('--- INICIANDO EXTRACCIÓN REAL DE ALUMNOS ---');
    await page.goto('https://coach-v2.anytimefitness.com/home/SP-0085', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(8000); 

    if (page.url().includes('login') || await page.getByText('Log into Dashboard').isVisible()) {
      console.log('Protocolo de login activo...');
      const splashButton = page.getByText('Log into Dashboard');
      if (await splashButton.isVisible()) {
        await splashButton.click();
        await page.waitForTimeout(5000);
      }

      await page.locator('input[type="email"], input[name="username"], #username').first().fill(process.env.ANYTIME_EMAIL);
      await page.locator('input[type="password"], #password').first().fill(process.env.ANYTIME_PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/home**', { waitUntil: 'load', timeout: 60000 });
      console.log('Login exitoso.');
    }

    await page.waitForTimeout(10000); 

    const studentList = new Set();
    let scrollAttempts = 0;
    let lastCount = 0;

    console.log('Buscando panel de alumnos...');

    while (scrollAttempts < 100) {
      const names = await page.evaluate(() => {
        // Selector agresivo para buscar nombres en las tarjetas de alumnos
        const elements = Array.from(document.querySelectorAll('div, li, span, h4')).filter(el => {
            // Buscamos elementos que tengan un estilo de "nombre de usuario" o que estén dentro de una lista infinita
            return el.textContent && el.textContent.length > 3 && el.textContent.length < 50 && 
                   !el.textContent.includes('Socio') && !el.textContent.includes('Pendiente');
        });
        return elements.map(el => el.textContent.trim());
      });

      names.forEach(n => {
          if (n && n.includes(' ') && !n.includes('\n')) studentList.add(n);
      });

      console.log(`Progreso: ${studentList.size} nombres detectados...`);

      if (studentList.size >= 148) break;

      // Scroll en el contenedor de alumnos
      await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight);
        containers.forEach(c => c.scrollBy(0, 1000));
        window.scrollBy(0, 1000);
      });

      await page.waitForTimeout(1500);
      
      if (studentList.size === lastCount) scrollAttempts++;
      else scrollAttempts = 0;
      
      lastCount = studentList.size;
      if (scrollAttempts > 10) break; 
    }

    const finalArray = Array.from(studentList).sort();
    console.log(`✅ Extracción finalizada. Total: ${finalArray.length} alumnos reales.`);

    // GUARDAR EN SUPABASE (Asegurándonos de que la columna existe)
    console.log('Actualizando Mainframe...');
    
    // Inyectamos el reporte con la lista real
    const { error } = await supabase.from('tj_reportes').insert([{
      total_alumnos: finalArray.length,
      mensajes_pendientes: 0,
      pendientes_escaneo: [],
      lista_alumnos: finalArray,
      creado_en: new Date().toISOString()
    }]);

    if (error) {
        console.error('Error al guardar lista real:', error.message);
        // Si falla por falta de columna, intentamos guardar un resumen en tj_mensajes
        await supabase.from('tj_mensajes').insert([{
            remitente_tipo: 'agente',
            remitente_id: '55555555-5555-5555-5555-555555555555',
            texto: `📊 REPORTE REAL: He extraído ${finalArray.length} alumnos. Primeros nombres: ${finalArray.slice(0, 5).join(', ')}...`,
            canal: '#general'
        }]);
    }

  } catch (err) {
    console.error('Fallo crítico en el robot:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeFullStudentList();
