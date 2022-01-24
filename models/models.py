# -*- coding: utf-8 -*-
#
# This will contains 3D information for products, fornitures, spaces, etc.

###

# from odoo import models, fields, api


# class odooxr-base(models.Model):
#     _name = 'odooxr-base.odooxr-base'
#     _description = 'odooxr-base.odooxr-base'

#     name = fields.Char()
#     value = fields.Integer()
#     value2 = fields.Float(compute="_value_pc", store=True)
#     description = fields.Text()
#
#     @api.depends('value')
#     def _value_pc(self):
#         for record in self:
#             record.value2 = float(record.value) / 100
