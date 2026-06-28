UPDATE opportunities
SET bank_financing_amount_cents = 150000000,
    short_description = 'Promoción residencial de un edificio de 9 viviendas en Travesía de la calle Coruña, zona Plaza América, Vigo. El proyecto está en marcha, con inversión cubierta, proyecto básico presentado y licencia pendiente.',
    description = 'Promoción residencial de 9 viviendas en Travesía de la calle Coruña, en la zona de Plaza América, Vigo. El proyecto está en marcha, cuenta con inversión cubierta, proyecto básico presentado y se encuentra pendiente de licencia. Los datos publicados tienen carácter informativo y pueden actualizarse durante la tramitación y ejecución.'
WHERE slug = 'promocion-9-viviendas-plaza-america-vigo';

UPDATE opportunities
SET short_description = 'Proyecto de cambio de uso de viviendas a hostal con 10 apartamentos en María Berdiales, Vigo. La operación está en estudio y cuenta con 800.000€ de inversión aportada.'
WHERE slug = 'cambio-uso-hostal-maria-berdiales-vigo';

UPDATE opportunity_highlights
SET label = 'Inversión',
    value = '800.000€ de inversión cubierta · 100%'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'promocion-9-viviendas-plaza-america-vigo')
  AND label = 'Financiación';

UPDATE opportunity_milestones
SET title = 'Inversión cubierta',
    description = 'Inversión prevista de 800.000€ completamente cubierta para el desarrollo del proyecto.'
WHERE opportunity_id = (SELECT id FROM opportunities WHERE slug = 'promocion-9-viviendas-plaza-america-vigo')
  AND title = 'Financiación cerrada';
