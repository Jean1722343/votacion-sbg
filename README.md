# Votación · Group Growth — AWS Student Builder Group

Web para que el equipo (4 integrantes + profesor asesor) elija a quién se queda en **Group Growth**.

- **Regla:** cada votante tiene **2 votos** y debe dárselos a **2 candidatos distintos**. Los dos con más votos quedan en 1.º y 2.º lugar.
- **Transparencia:** cada candidato muestra quién votó por él.
- **Expediente:** perfil, redes sociales y entrevistas (virtuales o presenciales) con audio/video y transcripción con buscador.
- **Analítica en vivo:** participación, ranking, podio con detección de empates, matriz votante × candidato, duplas más elegidas, actividad y exportación a CSV.

Sitio: https://jean1722343.github.io/votacion-sbg/

## Stack

- HTML + CSS + JavaScript (ES modules), sin build. Publicado con GitHub Pages.
- Firebase (plan gratis): **Authentication** (correo + PIN) y **Cloud Firestore** (tiempo real).
- Paleta oficial SBG (Squid Ink `#161D26`, naranja `#FF9900`, menta `#00E582`, azul `#42B4FF`, magenta `#FF57E9`, morado `#AD5CFF`) con Space Grotesk + Inter. No se usan Amazon Ember ni logos oficiales porque son activos bajo NDA.

## Privacidad

El repositorio es público, pero **ningún dato de los candidatos vive aquí**. Todo (perfiles, transcripciones, enlaces) está en Firestore y solo lo puede leer un votante con sesión iniciada. La config de `js/firebase-config.js` es pública por diseño; la seguridad la dan las reglas de `firestore.rules`.

## Primer uso (admin)

1. Abre el sitio. Como no hay votantes, aparece el correo `jean@sbg-vota.app`: escribe el PIN que quieras (mín. 6 caracteres) y pulsa **Crear cuenta de admin**.
2. En **Admin → Votación**: pulsa **Inicializar** y luego **Agregarme** como votante.
3. En **Admin → Candidatos**: **Cargar plantilla (6)** y llena cada perfil (nombre, carrera, foto, redes, motivación…).
4. En **Admin → Votantes**: da de alta a los otros 3 integrantes y al profesor. Se genera un PIN y un mensaje listo para mandarles por WhatsApp.

## Subir entrevistas

1. Sube el audio o video a Google Drive (compartir: "cualquiera con el enlace"), YouTube (oculto) o SoundCloud.
2. En **Admin → Candidatos → + Agregar entrevista**, pega el enlace, la fecha, la modalidad y la transcripción.
3. Para que la transcripción se vea por hablante usa el formato:

   ```
   [00:00] Jean: Gracias por venir…
   [00:12] María: Me interesa porque…
   ```

## Reglas de seguridad

`firestore.rules` garantiza en el servidor que:

- solo votantes registrados leen datos;
- cada quien escribe solo su propio voto, con exactamente 2 candidatos distintos que existan, y solo mientras la votación está abierta;
- solo el admin edita candidatos, votantes y la configuración.

Si cambias las reglas, pégalas en Firebase Console → Firestore → Reglas → Publicar.
