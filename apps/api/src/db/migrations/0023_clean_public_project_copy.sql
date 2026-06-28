UPDATE opportunities
SET short_description = 'Promoción residencial de un edificio de 9 viviendas en Travesía de la calle Coruña, zona Plaza América, Vigo. El proyecto está en marcha, con proyecto básico presentado y licencia pendiente.',
    description = 'Promoción residencial de 9 viviendas en Travesía de la calle Coruña, en la zona de Plaza América, Vigo. El proyecto está en marcha, tiene proyecto básico presentado y se encuentra pendiente de licencia. Los datos publicados tienen carácter informativo y pueden actualizarse durante la tramitación y ejecución.'
WHERE slug = 'promocion-9-viviendas-plaza-america-vigo';

UPDATE opportunity_highlights
SET label = 'Objetivo de inversión',
    value = '800.000€'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'promocion-9-viviendas-plaza-america-vigo')
  AND position = 1;

UPDATE opportunity_milestones
SET title = 'Objetivo de inversión definido',
    description = 'Definición del objetivo de inversión para el desarrollo del proyecto.'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'promocion-9-viviendas-plaza-america-vigo')
  AND position = 0;

UPDATE opportunities
SET short_description = 'Proyecto de cambio de uso de viviendas a hostal con 10 apartamentos en María Berdiales, Vigo. La operación está en estudio y en fase de análisis técnico y financiero.'
WHERE slug = 'cambio-uso-hostal-maria-berdiales-vigo';

UPDATE opportunity_highlights
SET label = 'Objetivo de inversión',
    value = '800.000€'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'cambio-uso-hostal-maria-berdiales-vigo')
  AND position = 1;

UPDATE opportunity_milestones
SET title = 'Estructuración de inversión',
    description = 'Revisión del objetivo de inversión y de las condiciones de participación.'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'cambio-uso-hostal-maria-berdiales-vigo')
  AND position = 2;
