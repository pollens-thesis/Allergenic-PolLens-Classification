"""
Fill the Allergen Reference content for the 23 species: common and Filipino
names, family, growth form, a short botanical description, where it grows in
the Philippines, pollination mode, and a freely licensed photo (bundled with
the frontend at photo_url) with its credit. Everything is editable in the admin.

No allergenicity is stated here: risk_level stays "Not assessed" until UPLB
supplies it. Photos are from Wikimedia Commons (CC0 / public domain / CC BY /
CC BY-SA), resized for the web.
"""

from django.db import migrations

FIELDS = (
    'common_name', 'filipino_name', 'family', 'growth_form', 'description', 'distribution',
    'pollination', 'info_source', 'photo_url', 'photo_credit', 'photo_license', 'photo_source',
)

DATA = {'amaranthus_spinosus': {'common_name': 'Spiny amaranth',
                         'filipino_name': 'Kulitis',
                         'family': 'Amaranthaceae',
                         'growth_form': 'Erect annual herb',
                         'description': 'A branched annual herb up to about 1 m tall, armed with paired '
                                        'sharp spines at the leaf bases. Its small greenish flowers are '
                                        'packed into dense spikes at the stem tips and in the leaf axils.',
                         'distribution': 'A common weed of waste places, roadsides and cultivated land '
                                         'throughout the Philippines.',
                         'pollination': 'Wind',
                         'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                        'Plants of the World Online (Kew) and StuartXchange Philippine '
                                        'Medicinal Plants; to be verified by the UPLB team.',
                         'photo_url': '/species/amaranthus_spinosus.jpg',
                         'photo_credit': 'Krzysztof Ziarnek, Kenraiz',
                         'photo_license': 'CC BY-SA 4.0',
                         'photo_source': 'https://commons.wikimedia.org/wiki/File:Amaranthus_spinosus_kz01.jpg'},
 'axonopus_compressus': {'common_name': 'Broadleaf carpet grass',
                         'filipino_name': '',
                         'family': 'Poaceae',
                         'growth_form': 'Creeping perennial grass',
                         'description': 'A low, mat-forming grass that spreads by creeping stolons, with '
                                        'flat, blunt-tipped leaves. Slender flowering stalks end in two to '
                                        'four narrow spike-like branches; it is widely planted as a lawn '
                                        'grass.',
                         'distribution': 'Lawns, parks, roadsides and open ground, especially in moist '
                                         'lowland areas.',
                         'pollination': 'Wind',
                         'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                        'Plants of the World Online (Kew) and StuartXchange Philippine '
                                        'Medicinal Plants; to be verified by the UPLB team.',
                         'photo_url': '/species/axonopus_compressus.jpg',
                         'photo_credit': 'Forest & Kim Starr',
                         'photo_license': 'CC BY 3.0',
                         'photo_source': 'https://commons.wikimedia.org/wiki/File:Starr_040812-0041_Axonopus_compressus.jpg'},
 'brachiaria_mutica': {'common_name': 'Para grass',
                       'filipino_name': '',
                       'family': 'Poaceae',
                       'growth_form': 'Trailing perennial grass',
                       'description': 'A robust grass with long trailing stems that root at the hairy nodes, '
                                      'forming dense stands in wet ground. It was introduced as a forage '
                                      'grass (also known as Urochloa mutica).',
                       'distribution': 'Ditches, riverbanks, rice-field margins and other wet places.',
                       'pollination': 'Wind',
                       'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                      'Plants of the World Online (Kew) and StuartXchange Philippine '
                                      'Medicinal Plants; to be verified by the UPLB team.',
                       'photo_url': '/species/brachiaria_mutica.jpg',
                       'photo_credit': 'Forest & Kim Starr',
                       'photo_license': 'CC BY 3.0',
                       'photo_source': 'https://commons.wikimedia.org/wiki/File:Starr_061128-1670_Urochloa_mutica.jpg'},
 'chloris_barbata': {'common_name': 'Swollen finger grass',
                     'filipino_name': '',
                     'family': 'Poaceae',
                     'growth_form': 'Tufted annual grass',
                     'description': 'A tufted grass with flattened stems topped by a finger-like cluster of '
                                    'purplish, bristly spikes.',
                     'distribution': 'Roadsides, sandy and disturbed ground, especially in dry, sunny '
                                     'places.',
                     'pollination': 'Wind',
                     'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                    'of the World Online (Kew) and StuartXchange Philippine Medicinal '
                                    'Plants; to be verified by the UPLB team.',
                     'photo_url': '/species/chloris_barbata.jpg',
                     'photo_credit': 'Forest & Kim Starr',
                     'photo_license': 'CC BY 3.0',
                     'photo_source': 'https://commons.wikimedia.org/wiki/File:Starr_040117-0035_Chloris_barbata.jpg'},
 'chrysopogon_aciculatus': {'common_name': 'Golden false beardgrass',
                            'filipino_name': 'Amorseko',
                            'family': 'Poaceae',
                            'growth_form': 'Creeping perennial grass',
                            'description': 'A low perennial grass spreading by stolons, with slender '
                                           'reddish-purple flower heads. Its sharp-pointed seeds catch in '
                                           'clothing and fur.',
                            'distribution': 'Lawns, pastures, trails and open grassland throughout the '
                                            'Philippines.',
                            'pollination': 'Wind',
                            'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                           'Plants of the World Online (Kew) and StuartXchange Philippine '
                                           'Medicinal Plants; to be verified by the UPLB team.',
                            'photo_url': '/species/chrysopogon_aciculatus.jpg',
                            'photo_credit': 'Vengolis',
                            'photo_license': 'CC BY-SA 3.0',
                            'photo_source': 'https://commons.wikimedia.org/wiki/File:Lesser_spear_grass_00882.jpg'},
 'cocos_nucifera': {'common_name': 'Coconut',
                    'filipino_name': 'Niyog',
                    'family': 'Arecaceae',
                    'growth_form': 'Tall palm',
                    'description': 'A solitary palm up to 25–30 m with a crown of feather-like fronds. '
                                   'Branched flower clusters among the leaves carry many small male flowers '
                                   'and fewer, larger female flowers.',
                    'distribution': 'Planted throughout the lowlands; one of the country’s major crops.',
                    'pollination': 'Wind and insects',
                    'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                   'of the World Online (Kew) and StuartXchange Philippine Medicinal Plants; '
                                   'to be verified by the UPLB team.',
                    'photo_url': '/species/cocos_nucifera.jpg',
                    'photo_credit': 'Anoopan at Malayalam Wikipedia',
                    'photo_license': 'CC BY 3.0',
                    'photo_source': 'https://commons.wikimedia.org/wiki/File:Coconut_Tree.JPG'},
 'cyperus_rotundus': {'common_name': 'Purple nutsedge',
                      'filipino_name': 'Mutha',
                      'family': 'Cyperaceae',
                      'growth_form': 'Perennial sedge',
                      'description': 'A grass-like sedge with triangular stems, glossy leaves and '
                                     'reddish-brown spikelets, spreading by underground tubers. It is '
                                     'regarded as one of the world’s most troublesome weeds.',
                      'distribution': 'Cultivated fields, gardens and waste ground.',
                      'pollination': 'Wind',
                      'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                     'Plants of the World Online (Kew) and StuartXchange Philippine '
                                     'Medicinal Plants; to be verified by the UPLB team.',
                      'photo_url': '/species/cyperus_rotundus.jpg',
                      'photo_credit': 'KevinTony',
                      'photo_license': 'CC BY-SA 4.0',
                      'photo_source': 'https://commons.wikimedia.org/wiki/File:Cyperus_rotundus_plant05.jpg'},
 'dactyloctenium_aegyptium': {'common_name': 'Crowfoot grass',
                              'filipino_name': '',
                              'family': 'Poaceae',
                              'growth_form': 'Spreading annual grass',
                              'description': 'A spreading annual whose flowering stalk ends in two to six '
                                             'short, stiff spikes radiating like a bird’s foot.',
                              'distribution': 'Dry roadsides, sandy soils and cultivated land.',
                              'pollination': 'Wind',
                              'info_source': "Compiled for PolLens from Co's Digital Flora of the "
                                             'Philippines, Plants of the World Online (Kew) and '
                                             'StuartXchange Philippine Medicinal Plants; to be verified by '
                                             'the UPLB team.',
                              'photo_url': '/species/dactyloctenium_aegyptium.jpg',
                              'photo_credit': 'Atamari',
                              'photo_license': 'CC BY-SA 3.0',
                              'photo_source': 'https://commons.wikimedia.org/wiki/File:Dactyloctenium_aegyptium_0001.jpg'},
 'digitaria_ciliaris': {'common_name': 'Southern crabgrass',
                        'filipino_name': '',
                        'family': 'Poaceae',
                        'growth_form': 'Sprawling annual grass',
                        'description': 'A sprawling annual that roots at its lower nodes, with two to nine '
                                       'slender finger-like spikes at the top of each stem.',
                        'distribution': 'A common weed of upland crops, lawns and waste places.',
                        'pollination': 'Wind',
                        'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                       'Plants of the World Online (Kew) and StuartXchange Philippine '
                                       'Medicinal Plants; to be verified by the UPLB team.',
                        'photo_url': '/species/digitaria_ciliaris.jpg',
                        'photo_credit': 'Forest & Kim Starr',
                        'photo_license': 'CC BY 3.0',
                        'photo_source': 'https://commons.wikimedia.org/wiki/File:Starr_020112-9001_Digitaria_ciliaris.jpg'},
 'echinochloa_crus_galli': {'common_name': 'Barnyard grass',
                            'filipino_name': '',
                            'family': 'Poaceae',
                            'growth_form': 'Robust annual grass',
                            'description': 'A robust annual grass without a ligule, with dense, often '
                                           'purplish and bristly flower clusters. It is one of the major '
                                           'weeds of rice.',
                            'distribution': 'Rice fields and other wet cultivated ground.',
                            'pollination': 'Wind',
                            'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                           'Plants of the World Online (Kew) and StuartXchange Philippine '
                                           'Medicinal Plants; to be verified by the UPLB team.',
                            'photo_url': '/species/echinochloa_crus_galli.jpg',
                            'photo_credit': 'JustineToul',
                            'photo_license': 'CC BY-SA 4.0',
                            'photo_source': 'https://commons.wikimedia.org/wiki/File:Flowering_of_Echinochloa_crus-galli_plant_(cockspur_grass_or_barnyard_grass).jpg'},
 'eleusine_indica': {'common_name': 'Goosegrass',
                     'filipino_name': 'Paragis',
                     'family': 'Poaceae',
                     'growth_form': 'Tufted annual grass',
                     'description': 'A tough, tufted annual with flattened, whitish stem bases and two to '
                                    'seven finger-like spikes at the top of each stem.',
                     'distribution': 'Very common on roadsides, lawns, paths and cultivated land.',
                     'pollination': 'Wind',
                     'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                    'of the World Online (Kew) and StuartXchange Philippine Medicinal '
                                    'Plants; to be verified by the UPLB team.',
                     'photo_url': '/species/eleusine_indica.jpg',
                     'photo_credit': 'Tauʻolunga',
                     'photo_license': 'CC BY-SA 3.0',
                     'photo_source': 'https://commons.wikimedia.org/wiki/File:Eleusine_indica,_closeup.jpg'},
 'imperata_cylindrica': {'common_name': 'Cogon grass',
                         'filipino_name': 'Kogon',
                         'family': 'Poaceae',
                         'growth_form': 'Rhizomatous perennial grass',
                         'description': 'An aggressive perennial with sharp-edged leaves and silky white, '
                                        'plume-like flower heads. It spreads by underground rhizomes and '
                                        'regrows quickly after fire.',
                         'distribution': 'Covers large areas of open grassland and cleared land throughout '
                                         'the Philippines.',
                         'pollination': 'Wind',
                         'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                        'Plants of the World Online (Kew) and StuartXchange Philippine '
                                        'Medicinal Plants; to be verified by the UPLB team.',
                         'photo_url': '/species/imperata_cylindrica.jpg',
                         'photo_credit': 'Symoum Syfullah Priyo',
                         'photo_license': 'CC BY-SA 4.0',
                         'photo_source': 'https://commons.wikimedia.org/wiki/File:Cogon_grass_near_a_pond.jpg'},
 'leucaena_leucocephala': {'common_name': 'White leadtree',
                           'filipino_name': 'Ipil-ipil',
                           'family': 'Fabaceae',
                           'growth_form': 'Shrub or small tree',
                           'description': 'A fast-growing shrub or small tree with finely divided, '
                                          'twice-pinnate leaves, white pompom flower heads and flat brown '
                                          'pods.',
                           'distribution': 'Introduced; common in thickets, fence rows and secondary growth.',
                           'pollination': 'Insects',
                           'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                          'Plants of the World Online (Kew) and StuartXchange Philippine '
                                          'Medicinal Plants; to be verified by the UPLB team.',
                           'photo_url': '/species/leucaena_leucocephala.jpg',
                           'photo_credit': 'Emőke Dénes',
                           'photo_license': 'CC BY-SA 4.0',
                           'photo_source': 'https://commons.wikimedia.org/wiki/File:Fabales_-_Leucaena_leucocephala_-_3.jpg'},
 'panicum_maximum': {'common_name': 'Guinea grass',
                     'filipino_name': '',
                     'family': 'Poaceae',
                     'growth_form': 'Tall tufted perennial grass',
                     'description': 'A tall, clump-forming grass up to about 2 m with a large, open, '
                                    'much-branched flower head. Introduced as a forage grass (also known as '
                                    'Megathyrsus maximus).',
                     'distribution': 'Roadsides, pastures, clearings and waste ground.',
                     'pollination': 'Wind',
                     'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                    'of the World Online (Kew) and StuartXchange Philippine Medicinal '
                                    'Plants; to be verified by the UPLB team.',
                     'photo_url': '/species/panicum_maximum.jpg',
                     'photo_credit': 'Tauʻolunga',
                     'photo_license': 'CC BY-SA 3.0',
                     'photo_source': 'https://commons.wikimedia.org/wiki/File:Panicum_maximum.jpg'},
 'pennisetum_polystachion': {'common_name': 'Mission grass',
                             'filipino_name': '',
                             'family': 'Poaceae',
                             'growth_form': 'Tufted grass',
                             'description': 'A tufted grass with dense, cylindrical, bristly flower spikes '
                                            'that turn golden to purplish (also known as Cenchrus '
                                            'polystachios).',
                             'distribution': 'Roadsides, cleared land and grassland.',
                             'pollination': 'Wind',
                             'info_source': "Compiled for PolLens from Co's Digital Flora of the "
                                            'Philippines, Plants of the World Online (Kew) and StuartXchange '
                                            'Philippine Medicinal Plants; to be verified by the UPLB team.',
                             'photo_url': '/species/pennisetum_polystachion.jpg',
                             'photo_credit': 'Marco Schmidt',
                             'photo_license': 'CC BY-SA 3.0',
                             'photo_source': 'https://commons.wikimedia.org/wiki/File:Pennisetum_polystachion_MS_1678.JPG'},
 'pithecellobium_dulce': {'common_name': 'Manila tamarind',
                          'filipino_name': 'Kamatsile',
                          'family': 'Fabaceae',
                          'growth_form': 'Spiny tree',
                          'description': 'A spiny tree with paired leaflets, small whitish flower heads and '
                                         'coiled pods holding sweet, white pulp.',
                          'distribution': 'Introduced from tropical America; common in towns, along roads '
                                          'and in dry lowlands.',
                          'pollination': 'Insects',
                          'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                         'Plants of the World Online (Kew) and StuartXchange Philippine '
                                         'Medicinal Plants; to be verified by the UPLB team.',
                          'photo_url': '/species/pithecellobium_dulce.jpg',
                          'photo_credit': 'Krzysztof Ziarnek, Kenraiz',
                          'photo_license': 'CC BY-SA 4.0',
                          'photo_source': 'https://commons.wikimedia.org/wiki/File:Pithecellobium_dulce_kz01.jpg'},
 'saccharum_spontaneum': {'common_name': 'Wild sugarcane',
                          'filipino_name': 'Talahib',
                          'family': 'Poaceae',
                          'growth_form': 'Tall rhizomatous perennial grass',
                          'description': 'A tall grass up to about 3 m with narrow leaves and large, silky '
                                         'white plumes; it forms extensive stands.',
                          'distribution': 'Riverbanks, open grassland and disturbed ground.',
                          'pollination': 'Wind',
                          'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                         'Plants of the World Online (Kew) and StuartXchange Philippine '
                                         'Medicinal Plants; to be verified by the UPLB team.',
                          'photo_url': '/species/saccharum_spontaneum.jpg',
                          'photo_credit': 'Nayan j Nath',
                          'photo_license': 'CC BY-SA 4.0',
                          'photo_source': 'https://commons.wikimedia.org/wiki/File:Saccharum_spontaneum3.jpg'},
 'samanea_saman': {'common_name': 'Rain tree',
                   'filipino_name': 'Akasya',
                   'family': 'Fabaceae',
                   'growth_form': 'Large tree',
                   'description': 'A large, wide-crowned tree whose leaflets fold at dusk and in rain, with '
                                  'pink, powder-puff flower heads and sweet pods.',
                   'distribution': 'Introduced; planted as a shade tree along roads and in parks throughout '
                                   'the country.',
                   'pollination': 'Insects',
                   'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                  'of the World Online (Kew) and StuartXchange Philippine Medicinal Plants; '
                                  'to be verified by the UPLB team.',
                   'photo_url': '/species/samanea_saman.jpg',
                   'photo_credit': 'Basile Morin',
                   'photo_license': 'CC BY-SA 4.0',
                   'photo_source': 'https://commons.wikimedia.org/wiki/File:Leaning_Samanea_saman_-_Rain_tree_-_on_the_bank_of_an_island_at_golden_hour_in_Si_Phan_Don_Laos.jpg'},
 'sorghum_halepense': {'common_name': 'Johnson grass',
                       'filipino_name': '',
                       'family': 'Poaceae',
                       'growth_form': 'Rhizomatous perennial grass',
                       'description': 'A tall perennial with broad leaves marked by a white midrib and a '
                                      'large, loose, purplish flower head; it spreads by rhizomes.',
                       'distribution': 'Disturbed ground and the margins of cultivated fields.',
                       'pollination': 'Wind',
                       'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                      'Plants of the World Online (Kew) and StuartXchange Philippine '
                                      'Medicinal Plants; to be verified by the UPLB team.',
                       'photo_url': '/species/sorghum_halepense.jpg',
                       'photo_credit': 'Tauʻolunga',
                       'photo_license': 'CC BY-SA 3.0',
                       'photo_source': 'https://commons.wikimedia.org/wiki/File:Sorghum_halepense_closeup.jpg'},
 'tridax_procumbens': {'common_name': 'Coat buttons',
                       'filipino_name': '',
                       'family': 'Asteraceae',
                       'growth_form': 'Creeping perennial herb',
                       'description': 'A hairy, creeping herb with toothed leaves and small daisy-like '
                                      'flower heads, cream rays around a yellow centre, held on long stalks.',
                       'distribution': 'Roadsides, lawns and waste places.',
                       'pollination': 'Insects',
                       'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                      'Plants of the World Online (Kew) and StuartXchange Philippine '
                                      'Medicinal Plants; to be verified by the UPLB team.',
                       'photo_url': '/species/tridax_procumbens.jpg',
                       'photo_credit': 'Wibowo Djatmiko (Wie146)',
                       'photo_license': 'CC BY-SA 3.0',
                       'photo_source': 'https://commons.wikimedia.org/wiki/File:Tridax_procum_100228-0139_ipb.jpg'},
 'oryza_sativa': {'common_name': 'Rice',
                  'filipino_name': 'Palay',
                  'family': 'Poaceae',
                  'growth_form': 'Annual cereal grass',
                  'description': 'The cultivated rice plant: an annual grass whose flowering panicles of '
                                 'spikelets become the grain. It is largely self-pollinating, but its '
                                 'flowers shed pollen into the air at flowering.',
                  'distribution': 'The country’s staple crop, grown in lowland paddies and upland fields.',
                  'pollination': 'Mostly self; wind',
                  'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants of "
                                 'the World Online (Kew) and StuartXchange Philippine Medicinal Plants; to '
                                 'be verified by the UPLB team.',
                  'photo_url': '/species/oryza_sativa.jpg',
                  'photo_credit': 'Vyacheslav Argenberg',
                  'photo_license': 'CC BY 4.0',
                  'photo_source': 'https://commons.wikimedia.org/wiki/File:Kanchanaburi,_Thailand,_Asian_rice_(Oryza_sativa)_grass.jpg'},
 'mimosa_pudica': {'common_name': 'Sensitive plant',
                   'filipino_name': 'Makahiya',
                   'family': 'Fabaceae',
                   'growth_form': 'Sprawling herb or subshrub',
                   'description': 'A prickly, sprawling plant whose leaflets fold when touched, with pink, '
                                  'globe-shaped flower heads.',
                   'distribution': 'Lawns, roadsides and waste ground.',
                   'pollination': 'Insects and wind',
                   'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, Plants "
                                  'of the World Online (Kew) and StuartXchange Philippine Medicinal Plants; '
                                  'to be verified by the UPLB team.',
                   'photo_url': '/species/mimosa_pudica.jpg',
                   'photo_credit': 'Anagoria',
                   'photo_license': 'CC BY 3.0',
                   'photo_source': 'https://commons.wikimedia.org/wiki/File:2012_Cuba_Mimosa_pudica_anagoria.JPG'},
 'mangifera_indica': {'common_name': 'Mango',
                      'filipino_name': 'Mangga',
                      'family': 'Anacardiaceae',
                      'growth_form': 'Large evergreen tree',
                      'description': 'An evergreen tree with long, leathery leaves and large branched '
                                     'clusters of small yellowish flowers at the branch tips.',
                      'distribution': 'Widely cultivated throughout the Philippines.',
                      'pollination': 'Insects',
                      'info_source': "Compiled for PolLens from Co's Digital Flora of the Philippines, "
                                     'Plants of the World Online (Kew) and StuartXchange Philippine '
                                     'Medicinal Plants; to be verified by the UPLB team.',
                      'photo_url': '/species/mangifera_indica.jpg',
                      'photo_credit': 'Yann',
                      'photo_license': 'CC BY-SA 4.0',
                      'photo_source': 'https://commons.wikimedia.org/wiki/File:Mango_tree_flowers,_Umaria_district,_MP,_India.jpg'}}


def fill(apps, schema_editor):
    Species = apps.get_model('reports', 'Species')
    for species in Species.objects.filter(id__in=DATA):
        for field, value in DATA[species.id].items():
            setattr(species, field, value)
        species.save(update_fields=list(FIELDS))


def empty(apps, schema_editor):
    Species = apps.get_model('reports', 'Species')
    Species.objects.filter(id__in=DATA).update(**{field: '' for field in FIELDS})


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0009_species_reference_fields'),
    ]

    operations = [
        migrations.RunPython(fill, empty),
    ]
