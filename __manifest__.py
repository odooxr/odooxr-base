# -*- coding: utf-8 -*-
{
    'name': "odooxr-base",

    'summary': """
        Base for Odoo XR""",

    'description': """
        With Odoo XR you will be able to incroduce your self into a virtual office with all Odoo resources available to work in
        your meta office.
    """,

    'author': "Cristian S. Rocha",
    'website': "http://www.yourcompany.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'website'],

    # always loaded
    'data': [
        # 'security/ir.model.access.csv',
        'views/views.xml',
        'views/xr_scripts.xml',
        'views/templates.xml',
        'views/snippets/s_vr_portal.xml',
        'views/snippets/snippets.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
}
