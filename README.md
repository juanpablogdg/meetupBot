Código fuente de la función para manejar el bot de los meetups.


Lo único que hay que modificar para que funcione es establecer un API key válido de meetup.com. Una vez que tengamos el API key, nos aseguramos que tenemos la herramienta del rubntime de configuración desplegado:


gcloud services enable runtimeconfig.googleapis.com


Y luego ponemos el valor del api key correspondiente :

gcloud beta runtime-config configs create dev-config
gcloud beta runtime-config configs variables \
    set api-key "{}" \
    --config-name dev-config

Para desplegar en la nube:

npm run cloud