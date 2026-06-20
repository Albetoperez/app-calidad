// ==========================================================================
// SIGMA PMO - BASE DE DATOS Y ESTRUCTURA MAESTRA (data.js)
// ==========================================================================

const DISCIPLINAS = [
    'Logística', 
    'Civil', 
    'Mecánicos', 
    'Eléctricos', 
    'Línea de Alta Tensión'
];

const UNIDADES = [
    'uds', 
    'ml', 
    'm3', 
    '%', 
    'ha', 
    'lote'
];

// Plantilla base (Contrato 0). Las fechas y vínculos se inyectan vacíos por defecto
// para preparar el motor del Diagrama Gantt desde el primer momento.
const ESTRUCTURA_MAESTRA = {
    'Logística': {
        '1.1 HINCAS': [
            { item: 'Suministro de hincas', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.2 ESTRUCTURA': [
            { item: 'Suministro de estructura', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.3 MÓDULOS': [
            { item: 'Suministro de módulos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.4 INVERSORES': [
            { item: 'Suministro de inversores', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.5 CABLES': [
            { item: 'Suministro de cables', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.6 SCBs': [
            { item: 'Suministro de cajas SCB', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '1.7 SCADA y CCTV': [
            { item: 'Suministro de SCADA', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Suministro de CCTV', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ]
    },
    
    'Civil': {
        '2.1 MOVIMIENTO DE TIERRAS': [
            { item: 'Desmonte', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Terraplén', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Nivelación', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.2 VALLADO PERIMETRAL': [
            { item: 'Vallado perimetral', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.3 VIALES': [
            { item: 'Cajeado', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Pasos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Relleno de sub-base', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Relleno de base', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.4 LOSAS POWER STATION': [
            { item: 'losa de hormigon', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion de tubos', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'skid', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.5 DRENAJES': [
            { item: 'Drenajes trapezoidales', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'ODT', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.6 ZANJAS DE BT': [
            { item: 'Excavacion', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion de tubos', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Relleno', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.7 ZANJAS DE MT': [
            { item: 'Excavacion', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] },
            { item: 'Instalacion de tubos', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] },
            { item: 'Relleno', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.8 ARQUETAS Y CIMENTACIONES MENORES': [
            { item: 'arquetas', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'cimentaciones torres', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'cimentaciones CCTV', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '2.9 CCTV': [
            { item: 'Excavacion de zanjas', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion de tubos', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Relleno de zanjas', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            
        ],
        '2.10 EDIFICIO OM': [
            { item: 'Movimiento de tierras', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Cimentaciones', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Pilares', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Fachadas y particiones', meta: 0, unidad: 'm2', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Cubierta', meta: 0, unidad: 'm2', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Enfoscados', meta: 0, unidad: 'm2', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion de fontaneria', meta: 0, unidad: 'lote', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion electrica', meta: 0, unidad: 'lote', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion contra incendios', meta: 0, unidad: 'lote', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Acabados', meta: 0, unidad: 'lote', fechaInicio: '', fechaFin: '', vinculos: [] }
        ]
    },
    
    'Mecánicos': {
        '3.1 INSTALACIÓN DE HINCAS': [
            { item: 'Instalación de hincas', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '3.2 MONTAJE DE ESTRUCTURA': [
            { item: 'Montaje de estructura', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '3.3 MONTAJE DE MODULOS': [
            { item: 'Montaje de módulos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ]
    },
    
    'Eléctricos': {
        '4.1 STRINGS': [
            { item: 'Conexionado de modulos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Tendido de cable solar', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado de cable solar - MC4', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.2 CABLE BT': [
            { item: 'Red de tierra', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Tendido de cable de BT', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado de cable en SCB', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.3 CABLE MT': [
            { item: 'Red de tierra', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Tendido de cable de MT', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Tendido de F.O.', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.4 Cable GW Tracker': [
            { item: 'Tendido', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.5 SCBs': [
            { item: 'Instalacion mecánica de cajas', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado de string en SCB', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.6 Power Station': [
            { item: 'Instalacion de Equipos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado BT', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado MT (por botella)', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Pararrayos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.7 torres de comunicacion': [
            { item: 'MBOX', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'TBOX', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'CSB', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'GATEWAY', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.8 CCTV': [
            { item: 'instalacion de baculos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Instalacion de camaras', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Conexionado y fusionado de fibra', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.9 SCADA PV': [
            { item: 'Instalacion Scada hardware', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Fusionado de fibra', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Configuracion de equipos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }
        ],
        '4.10 ESTACIÓN METEOROLÓGICA': [
            { item: 'Estación Meteorológica', meta: 0, unidad: 'lote', fechaInicio: '', fechaFin: '', vinculos: [] }
        ]
    },
    
    'Línea de Alta Tensión': {
        '6.1 LAT': [
            { item: 'Excavacion', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Cimentacion de apoyos', meta: 0, unidad: 'm3', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Puesta a tierra', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Izado de apoyos', meta: 0, unidad: 'uds', fechaInicio: '', fechaFin: '', vinculos: [] }, 
            { item: 'Tendido de cables', meta: 0, unidad: 'ml', fechaInicio: '', fechaFin: '', vinculos: [] }
        ]
    }
};