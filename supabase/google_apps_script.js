/**
 * AKU Tracker — Google Forms → Supabase
 * =======================================
 * Instrucciones:
 * 1. En el Google Sheet vinculado al formulario, ve a Extensiones → Apps Script
 * 2. Pega este código completo
 * 3. Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con tus valores reales
 *    (los encuentras en Supabase → Project Settings → API)
 * 4. Ve a Disparadores (ícono del reloj) → Añadir disparador:
 *      Función: onFormSubmit
 *      Evento: Al enviar formulario
 * 5. Autoriza los permisos cuando te los pida
 *
 * IMPORTANTE: Los nombres de los campos (entre comillas en namedValues)
 * deben coincidir EXACTAMENTE con el texto de las preguntas en tu Google Form.
 * Ajústalos si son distintos.
 */

// ── Configuración ─────────────────────────────────────────────
var SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';   // ← cambia esto
var SUPABASE_KEY  = 'TU-ANON-KEY';                        // ← cambia esto

// Cursos virtuales: mapeo nombre → código
// Deben coincidir con las opciones del formulario
var VIRTUAL_COURSES = {
  'RCZ — Real Coders Zero':      'RCZ',
  'RC1 — Real Coders 1':         'RC1',
  'RC2 — Real Coders 2':         'RC2',
  'MC1 — Micro Coders 1':        'MC1',
  'MC2 — Micro Coders 2':        'MC2',
  'PGZ — Python Zero':            'PGZ',
  'PG1 — Python Games 1':        'PG1',
  'PG2 — Python Games 2':        'PG2',
  'PG3 — Python Games 3':        'PG3',
  'RBX1 — Roblox 1':             'RBX1',
  'RBX2 — Roblox 2':             'RBX2',
  'UNI1 — Unity 1':              'UNI1',
  'UNI2 — Unity 2':              'UNI2',
  'YT1 — YouTube Creator 1':     'YT1',
  'YT2 — YouTube Creator 2':     'YT2',
  'IA1 — IA Fundamentos 1':      'IA1',
  'IAG1 — IA Generativa 1':      'IAG1',
  'IAG2 — IA Generativa 2':      'IAG2',
};

// ── Función principal ─────────────────────────────────────────
function onFormSubmit(e) {
  try {
    var r = e.namedValues;

    // Helper: obtiene el primer valor del campo o cadena vacía
    function get(fieldName) {
      var val = r[fieldName];
      return (val && val[0]) ? val[0].trim() : '';
    }

    // ── Leer campos del formulario ────────────────────────────
    // ⚠️  Ajusta los nombres entre comillas para que coincidan
    //     exactamente con las preguntas de tu Google Form

    var parentName    = get('Nombre y apellidos del padre/madre');
    var email         = get('Correo electrónico');
    var phone         = get('Celular');
    var cedula        = get('Cédula');
    var address       = get('Dirección');
    var city          = get('Ciudad');
    var department    = get('Departamento');
    var childName     = get('Nombre de tu hijo(a)');
    var dobRaw        = get('Fecha de Nacimiento de tu hijo');
    var school        = get('Colegio?');
    var grade         = get('Grado que cursa?');
    var referral      = get('Sí es tu primera vez cuéntanos cómo nos has conocido?');
    var courseChoice  = get('Cuál curso va tomar tu hijo(a)?');
    var newsletterStr = get('Quieres recibir noticias sobre nuestros cursos y actividades para niños por correo?');

    // ── Derivar valores ───────────────────────────────────────
    // Google Forms puede entregar fechas como DD/MM/YYYY o MM/DD/YYYY según
    // la configuración regional del Sheet. Detectamos el formato automáticamente:
    // si la segunda parte > 12, no puede ser un mes → formato MM/DD/YYYY.
    var dateOfBirth = null;
    if (dobRaw) {
      var parts = dobRaw.split('/');
      if (parts.length === 3) {
        var p0   = parseInt(parts[0], 10);
        var p1   = parseInt(parts[1], 10);
        var year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        var day, month;
        if (p1 > 12) {
          // Formato MM/DD/YYYY (americano)
          month = String(p0).padStart(2, '0');
          day   = String(p1).padStart(2, '0');
        } else {
          // Formato DD/MM/YYYY (Colombia) — asumido por defecto
          day   = String(p0).padStart(2, '0');
          month = String(p1).padStart(2, '0');
        }
        dateOfBirth = year + '-' + month + '-' + day;
      }
    }

    var newsletterOptIn = newsletterStr.toLowerCase().includes('sí') ||
                          newsletterStr.toLowerCase().includes('si') ||
                          newsletterStr.toLowerCase().includes('yes');

    // Determinar modalidad según el curso seleccionado
    var isVirtual = Object.keys(VIRTUAL_COURSES).indexOf(courseChoice) !== -1;
    var modality  = isVirtual ? 'virtual' : 'presencial';

    // ── Construir objeto para Supabase ────────────────────────
    var student = {
      name:               childName || 'Sin nombre',
      email:              email,
      phone:              phone,
      parent_name:        parentName,
      parent_cedula:      cedula || null,
      address:            address || null,
      city:               city || null,
      department:         department || null,
      school_name:        school || null,
      grade_level:        grade || null,
      date_of_birth:      dateOfBirth,
      referral_source:    referral || null,
      course_interest:    courseChoice || null,
      newsletter_opt_in:  newsletterOptIn,
      modality:           modality,
      enrollment_date:    new Date().toISOString().split('T')[0],
      pack_size:          8,
      classes_remaining:  8,
      classes_attended:   0,
      is_active:          true,
      archived:           false,
    };

    // ── Insertar en Supabase ──────────────────────────────────
    var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/students', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=representation',
      },
      payload:          JSON.stringify(student),
      muteHttpExceptions: true,
    });

    var statusCode = response.getResponseCode();
    var body       = response.getContentText();

    if (statusCode === 201) {
      Logger.log('✅ Alumno insertado correctamente: ' + childName);
      Logger.log('Respuesta: ' + body);
    } else {
      Logger.log('❌ Error al insertar alumno. Status: ' + statusCode);
      Logger.log('Respuesta: ' + body);
      // Opcional: enviar email de alerta al admin
      // MailApp.sendEmail('tu@email.com', 'Error AKU Form', body);
    }

  } catch (err) {
    Logger.log('❌ Excepción en onFormSubmit: ' + err.toString());
  }
}

/**
 * Función de prueba — Ejecuta esto manualmente para verificar
 * que la conexión con Supabase funciona antes de activar el disparador.
 */
function testConnection() {
  var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/students?limit=1', {
    method: 'get',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    muteHttpExceptions: true,
  });
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Body: '   + response.getContentText());
}

/**
 * Importación masiva — ejecuta esto UNA SOLA VEZ para migrar
 * los registros existentes en el Sheet a Supabase.
 * Lee todas las filas con datos y las inserta una por una.
 */
function importExistingStudents() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data  = sheet.getDataRange().getValues();

  // Fila 0 = encabezados, datos desde fila 1
  var headers = data[0];
  var rows    = data.slice(1);

  var ok     = 0;
  var errors = 0;

  rows.forEach(function(row, index) {
    // Saltar filas completamente vacías
    if (row.every(function(cell) { return cell === ''; })) return;

    function col(name) {
      var i = headers.indexOf(name);
      return (i !== -1 && row[i] !== '') ? String(row[i]).trim() : '';
    }

    var parentName    = col('Nombre y apellidos del padre/madre');
    var email         = col('Correo electrónico');
    var phone         = col('Celular');
    var cedula        = col('Cédula');
    var address       = col('Dirección');
    var city          = col('Ciudad');
    var department    = col('Departamento');
    var childName     = col('Nombre de tu hijo(a)');
    var dobRaw        = col('Fecha de Nacimiento de tu hijo');
    var school        = col('Colegio?');
    var grade         = col('Grado que cursa?');
    var referral      = col('Sí es tu primera vez cuéntanos cómo nos has conocido?');
    var courseChoice  = col('Cuál curso va tomar tu hijo(a)?');
    var newsletterStr = col('Quieres recibir noticias sobre nuestros cursos y actividades para niños por correo?');

    // Convertir fecha — detecta DD/MM/YYYY o MM/DD/YYYY automáticamente
    var dateOfBirth = null;
    if (dobRaw) {
      var parts = dobRaw.split('/');
      if (parts.length === 3) {
        var p0   = parseInt(parts[0], 10);
        var p1   = parseInt(parts[1], 10);
        var year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        var day, month;
        if (p1 > 12) {
          month = String(p0).padStart(2, '0');
          day   = String(p1).padStart(2, '0');
        } else {
          day   = String(p0).padStart(2, '0');
          month = String(p1).padStart(2, '0');
        }
        dateOfBirth = year + '-' + month + '-' + day;
      }
    }

    var isVirtual   = Object.keys(VIRTUAL_COURSES).indexOf(courseChoice) !== -1;
    var modality    = isVirtual ? 'virtual' : 'presencial';
    var newsletter  = newsletterStr.toLowerCase().includes('sí') ||
                      newsletterStr.toLowerCase().includes('si') ||
                      newsletterStr.toLowerCase().includes('yes');

    var student = {
      name:              childName || 'Sin nombre',
      email:             email,
      phone:             phone,
      parent_name:       parentName,
      parent_cedula:     cedula || null,
      address:           address || null,
      city:              city || null,
      department:        department || null,
      school_name:       school || null,
      grade_level:       grade || null,
      date_of_birth:     dateOfBirth,
      referral_source:   referral || null,
      course_interest:   courseChoice || null,
      newsletter_opt_in: newsletter,
      modality:          modality,
      enrollment_date:   new Date().toISOString().split('T')[0],
      pack_size:          8,
      classes_remaining:  8,
      classes_attended:   0,
      is_active:          true,
      archived:           false,
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/students', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=minimal',
      },
      payload:            JSON.stringify(student),
      muteHttpExceptions: true,
    });

    var status = response.getResponseCode();
    if (status === 201) {
      Logger.log('✅ Fila ' + (index + 2) + ': ' + childName + ' insertado');
      ok++;
    } else {
      Logger.log('❌ Fila ' + (index + 2) + ': ' + childName + ' — ' + response.getContentText());
      errors++;
    }

    // Pausa breve para no saturar la API
    Utilities.sleep(300);
  });

  Logger.log('──────────────────────────────');
  Logger.log('Importación terminada: ' + ok + ' insertados, ' + errors + ' errores');
}

/**
 * Importación masiva de clases de prueba desde una exportación de Calendly.
 * ============================================================================
 * Instrucciones:
 * 1. En Calendly: Reportes → Actividad → Exportar CSV
 * 2. Abre el CSV exportado en Google Sheets (o cópialo a una pestaña nueva)
 * 3. Asegúrate de que la hoja activa sea esa pestaña con los datos de Calendly
 * 4. Ejecuta esta función una sola vez
 *
 * Columnas esperadas (las que exporta Calendly):
 *   Invitee Name, Invitee Email, Text Reminder Number,
 *   Start Date & Time, Canceled,
 *   Question 1, Response 1 (Celular)
 *   Question 2, Response 2 (Nombre del hijo)
 *   Question 3, Response 3 (Edad)
 *   Question 4, Response 4 (Ciudad)
 *   Question 5, Response 5 (Experiencia previa)
 *   Question 6, Response 6 (Cómo nos conociste)
 */
function importCalendlyLeads() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data  = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows    = data.slice(1);

  function col(row, name) {
    var i = headers.indexOf(name);
    return (i !== -1 && row[i] !== '') ? String(row[i]).trim() : '';
  }

  // Parse "M/D/YYYY H:MM AM" or "M/D/YYYY HH:MM" → "YYYY-MM-DD"
  function parseCalendlyDate(raw) {
    if (!raw) return null;
    // Remove time part — keep only the date portion before the first space
    var datePart = raw.split(' ')[0];  // e.g. "2/15/2026"
    var parts = datePart.split('/');
    if (parts.length !== 3) return null;
    var month = parts[0].padStart(2, '0');
    var day   = parts[1].padStart(2, '0');
    var year  = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    return year + '-' + month + '-' + day;
  }

  var ok     = 0;
  var errors = 0;
  var skipped = 0;

  rows.forEach(function(row, index) {
    // Skip empty rows
    if (row.every(function(c) { return c === ''; })) return;

    var parentName  = col(row, 'Invitee Name');
    var parentEmail = col(row, 'Invitee Email');
    var phone       = col(row, 'Response 1') || col(row, 'Text Reminder Number');
    var childName   = col(row, 'Response 2') || '(por confirmar)';
    var age         = col(row, 'Response 3');
    var city        = col(row, 'Response 4');
    var experience  = col(row, 'Response 5');
    var referral    = col(row, 'Response 6');
    var startRaw    = col(row, 'Start Date & Time');
    var canceled    = col(row, 'Canceled').toLowerCase();

    var trialDate = parseCalendlyDate(startRaw);
    if (!trialDate) {
      Logger.log('⚠️  Fila ' + (index + 2) + ': fecha inválida "' + startRaw + '", omitida');
      skipped++;
      return;
    }

    var noteParts = [];
    if (age)        noteParts.push('Edad: ' + age);
    if (city)       noteParts.push('Ciudad: ' + city);
    if (experience) noteParts.push('Exp. previa: ' + experience);
    if (referral)   noteParts.push('Referido: ' + referral);

    var status = (canceled === 'true' || canceled === 'yes' || canceled === 'sí')
      ? 'cancelled'
      : 'scheduled';

    var lead = {
      parent_name:      parentName || '(sin nombre)',
      parent_email:     parentEmail || null,
      parent_phone:     phone || null,
      child_name:       childName,
      trial_class_date: trialDate,
      notes:            noteParts.length > 0 ? noteParts.join(' | ') : null,
      status:           status,
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/trial_leads', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=minimal',
      },
      payload:            JSON.stringify(lead),
      muteHttpExceptions: true,
    });

    var status_code = response.getResponseCode();
    if (status_code === 201) {
      Logger.log('✅ Fila ' + (index + 2) + ': ' + parentName + ' insertado');
      ok++;
    } else {
      Logger.log('❌ Fila ' + (index + 2) + ': ' + parentName + ' — ' + response.getContentText());
      errors++;
    }

    Utilities.sleep(200);
  });

  Logger.log('──────────────────────────────────────────────────');
  Logger.log('Clases de prueba: ' + ok + ' insertadas, ' + errors + ' errores, ' + skipped + ' omitidas');
}
