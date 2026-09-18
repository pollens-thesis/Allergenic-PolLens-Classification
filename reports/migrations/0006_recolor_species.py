# Fixes a color collision surfaced by a frontend design critique:
# pithecellobium_dulce and dactyloctenium_aegyptium shared the exact same
# hex (#e34948), a guaranteed collision whenever both land in the
# frontend's historical chart's top-8-by-volume line selection at once.
# Mirrors the same change made to app/PolLens/lib/data.ts's speciesCatalog
# — the two must stay in sync, since some frontend surfaces read this
# table live (useSpeciesCatalog()) while others still use the bundled
# fallback.
from django.db import migrations

OLD_COLOR = "#e34948"
NEW_COLOR = "#0891b2"


def recolor(apps, schema_editor):
    Species = apps.get_model("reports", "Species")
    Species.objects.filter(id="pithecellobium_dulce").update(color=NEW_COLOR)


def revert(apps, schema_editor):
    Species = apps.get_model("reports", "Species")
    Species.objects.filter(id="pithecellobium_dulce").update(color=OLD_COLOR)


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0005_species_id_to_fk"),
    ]

    operations = [
        migrations.RunPython(recolor, revert),
    ]
