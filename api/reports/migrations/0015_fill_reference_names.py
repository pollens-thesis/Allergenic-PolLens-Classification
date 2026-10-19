from django.db import migrations

# The names the Allergen Reference used to hardcode in the frontend
# (lib/species-names.ts DATASET_SPECIES_NAMES); admins now edit them in the app.
REFERENCE_NAMES = {
    'amaranthus_spinosus': 'Pigweed',
    'brachiaria_mutica': 'Paragrass',
    'chloris_barbata': 'Koroskorosan',
    'chrysopogon_aciculatus': 'Amorseco',
    'dactyloctenium_aegyptium': 'Egyptian grass',
    'digitaria_ciliaris': 'Crabgrass',
    'imperata_cylindrica': 'Cogon',
    'leucaena_leucocephala': 'Ipil-ipil',
    'mangifera_indica': 'Mango',
    'mimosa_pudica': 'Makahiya',
    'oryza_sativa': 'Rice pollen',
    'panicum_maximum': 'Guinea grass',
    'pennisetum_polystachion': 'Foxtail',
    'sorghum_halepense': 'Johnson grass',
    'tridax_procumbens': 'Wild daisy',
}


def fill_reference_names(apps, schema_editor):
    Species = apps.get_model('reports', 'Species')
    for species_id, name in REFERENCE_NAMES.items():
        Species.objects.filter(pk=species_id, reference_name='').update(reference_name=name)


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0014_species_reference_name_photo'),
    ]

    operations = [
        migrations.RunPython(fill_reference_names, migrations.RunPython.noop),
    ]
