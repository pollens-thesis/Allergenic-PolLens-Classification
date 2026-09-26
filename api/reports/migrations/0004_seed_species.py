# Seeds the 23-species UPLB catalog. code/color are copied verbatim from
# app/PolLens/lib/data.ts's existing hand-derived values (first 4 letters
# of genus; an 8-hue palette cycled every 8 species) rather than
# re-implementing that derivation here — species are added rarely, by
# hand, through admin, so there's no ongoing process that needs to
# regenerate them.
from django.db import migrations

SPECIES = [
    # (sort_order, id, scientific_name, code, color)
    (1, 'amaranthus_spinosus', 'Amaranthus spinosus', 'AMAR', '#2a78d6'),
    (2, 'axonopus_compressus', 'Axonopus compressus', 'AXON', '#eb6834'),
    (3, 'brachiaria_mutica', 'Brachiaria mutica', 'BRAC', '#1baf7a'),
    (4, 'chloris_barbata', 'Chloris barbata', 'CHLO', '#eda100'),
    (5, 'chrysopogon_aciculatus', 'Chrysopogon aciculatus', 'CHRY', '#e87ba4'),
    (6, 'cocos_nucifera', 'Cocos nucifera', 'COCO', '#008300'),
    (7, 'cyperus_rotundus', 'Cyperus rotundus', 'CYPE', '#4a3aa7'),
    (8, 'dactyloctenium_aegyptium', 'Dactyloctenium aegyptium', 'DACT', '#e34948'),
    (9, 'digitaria_ciliaris', 'Digitaria ciliaris', 'DIGI', '#2a78d6'),
    (10, 'echinochloa_crus_galli', 'Echinochloa crus-galli', 'ECHI', '#eb6834'),
    (11, 'eleusine_indica', 'Eleusine indica', 'ELEU', '#1baf7a'),
    (12, 'imperata_cylindrica', 'Imperata cylindrica', 'IMPE', '#eda100'),
    (13, 'leucaena_leucocephala', 'Leucaena leucocephala', 'LEUC', '#e87ba4'),
    (14, 'panicum_maximum', 'Panicum maximum', 'PANI', '#008300'),
    (15, 'pennisetum_polystachion', 'Pennisetum polystachion', 'PENN', '#4a3aa7'),
    (16, 'pithecellobium_dulce', 'Pithecellobium dulce', 'PITH', '#e34948'),
    (17, 'saccharum_spontaneum', 'Saccharum spontaneum', 'SACC', '#2a78d6'),
    (18, 'samanea_saman', 'Samanea saman', 'SAMA', '#eb6834'),
    (19, 'sorghum_halepense', 'Sorghum halepense', 'SORG', '#1baf7a'),
    (20, 'tridax_procumbens', 'Tridax procumbens', 'TRID', '#eda100'),
    (21, 'oryza_sativa', 'Oryza sativa', 'ORYZ', '#e87ba4'),
    (22, 'mimosa_pudica', 'Mimosa pudica', 'MIMO', '#008300'),
    (23, 'mangifera_indica', 'Mangifera indica', 'MANG', '#4a3aa7'),
]

SPECIES_IDS = [row[1] for row in SPECIES]


def seed_species(apps, schema_editor):
    Species = apps.get_model('reports', 'Species')
    Species.objects.bulk_create(
        Species(
            id=species_id, sort_order=sort_order, scientific_name=scientific_name,
            code=code, color=color, common_name='', season='', risk_level='Moderate',
        )
        for sort_order, species_id, scientific_name, code, color in SPECIES
    )


def unseed_species(apps, schema_editor):
    Species = apps.get_model('reports', 'Species')
    Species.objects.filter(id__in=SPECIES_IDS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0003_species'),
    ]

    operations = [
        migrations.RunPython(seed_species, unseed_species),
    ]
