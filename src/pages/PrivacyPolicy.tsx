export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Última actualización: 16 de mayo de 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Responsable del tratamiento</h2>
            <p>
              <strong>AKUMAYA Educación</strong> ("AKUMAYA", "nosotros") es responsable del tratamiento de los datos personales recopilados a través de AKU Tracker, su sistema interno de gestión académica. Esta política describe qué datos recolectamos, con qué finalidad, con quién los compartimos y los derechos que tienen los titulares conforme a la Ley 1581 de 2012 de Protección de Datos Personales de Colombia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Datos personales que recopilamos</h2>
            <p>Recolectamos los siguientes datos para la operación de la academia:</p>

            <h3 className="font-semibold mt-3 mb-1">2.1 De padres y madres</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nombre completo</li>
              <li>Número de teléfono celular</li>
              <li>Correo electrónico</li>
              <li>Ciudad de residencia</li>
            </ul>

            <h3 className="font-semibold mt-3 mb-1">2.2 De estudiantes (menores de edad)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nombre completo</li>
              <li>Fecha de nacimiento o edad</li>
              <li>Curso de interés y modalidad (virtual / presencial)</li>
              <li>Registros de asistencia a clases</li>
              <li>Notas pedagógicas sobre progreso académico</li>
            </ul>

            <h3 className="font-semibold mt-3 mb-1">2.3 De interacciones por mensajería</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Conversaciones de WhatsApp con nuestro asistente Pablo</li>
              <li>Mensajes directos (DMs) enviados a nuestra cuenta de Instagram @akumaya</li>
              <li>Identificador de usuario de cada plataforma (teléfono en WhatsApp, ID de Instagram)</li>
            </ul>

            <h3 className="font-semibold mt-3 mb-1">2.4 Datos administrativos</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Historial de pagos y planes de inscripción</li>
              <li>Citas agendadas para clases de prueba</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Finalidades del tratamiento</h2>
            <p>Usamos los datos exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Inscribir estudiantes y gestionar su trayectoria académica</li>
              <li>Programar y dar seguimiento a clases de prueba y regulares</li>
              <li>Procesar pagos y enviar recordatorios</li>
              <li>Responder consultas e inquietudes recibidas por nuestros canales de mensajería</li>
              <li>Mejorar nuestros servicios educativos</li>
            </ul>
            <p className="mt-2">
              No usamos los datos para publicidad de terceros ni los vendemos a otras empresas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Encargados y terceros</h2>
            <p>Los datos son procesados por los siguientes proveedores tecnológicos, que actúan como encargados bajo contratos de tratamiento adecuados:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Supabase Inc.</strong> — almacenamiento de base de datos y backend</li>
              <li><strong>Meta Platforms, Inc.</strong> — recepción de mensajes vía Facebook Messenger e Instagram Messaging</li>
              <li><strong>Twilio Inc.</strong> — recepción de mensajes vía WhatsApp Business</li>
              <li><strong>Anthropic, PBC.</strong> — procesamiento de lenguaje natural del asistente Pablo</li>
              <li><strong>Calendly LLC.</strong> — gestión de agendamiento de clases de prueba</li>
              <li><strong>Railway Corp.</strong> — alojamiento de la aplicación web AKU Tracker</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Tiempo de conservación</h2>
            <p>
              Los datos de estudiantes activos se conservan mientras dure la relación académica. Los datos de exalumnos y leads no convertidos se conservan por un máximo de cinco (5) años con fines estadísticos y de reactivación, salvo solicitud expresa de eliminación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Derechos del titular</h2>
            <p>
              Como titular de los datos personales (o representante legal en caso de menores de edad), tienes derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Conocer, actualizar y rectificar tus datos</li>
              <li>Solicitar copia de los datos que tenemos sobre ti</li>
              <li>Solicitar la eliminación de tus datos cuando no exista deber legal de conservarlos</li>
              <li>Revocar la autorización para el tratamiento</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Menores de edad</h2>
            <p>
              Dado que muchos de nuestros estudiantes son menores de edad, el tratamiento de sus datos se realiza únicamente con autorización previa y expresa de sus padres o representantes legales, conforme al artículo 7 de la Ley 1581 de 2012 y la Sentencia C-748 de 2011 de la Corte Constitucional.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y administrativas razonables para proteger los datos personales contra acceso no autorizado, pérdida o alteración: cifrado en tránsito (HTTPS), autenticación de usuarios del sistema, controles de acceso basados en roles, y registros de auditoría de operaciones sensibles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Contacto</h2>
            <p>
              Para ejercer tus derechos o realizar cualquier consulta sobre el tratamiento de tus datos personales, escríbenos a:
            </p>
            <p className="mt-2">
              <strong>AKUMAYA Educación</strong><br />
              Correo electrónico: <a href="mailto:hola@akumaya.com" className="text-primary underline">hola@akumaya.com</a><br />
              WhatsApp: a través del canal oficial de la academia
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Responderemos las solicitudes en un plazo máximo de quince (15) días hábiles, conforme al artículo 14 de la Ley 1581 de 2012.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política cuando sea necesario. La versión vigente siempre estará disponible en esta misma URL y la fecha de "última actualización" reflejará la versión más reciente.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 AKUMAYA Educación. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
