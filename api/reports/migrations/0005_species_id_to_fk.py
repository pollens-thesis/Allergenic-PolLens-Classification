# Hand-written: converts Detection.species_id / Grain.species_id from a
# plain CharField(choices=...) into a real FK to Species. Uses
# RenameField + AlterField (not RemoveField + AddField) so the existing
# `species_id` column is altered in place rather than dropped and
# recreated — the FK's default column name for a field named `species` is
# `species_id` (Django's <field>_id convention), which coincides with
# today's column name, so this nets out to the same physical column with
# no data-loss window. Django's makemigrations autodetector doesn't offer
# this as a rename here (the CharField->ForeignKey type change is too
# different for its heuristic to suggest one), so this was authored by
# hand instead of accepting the auto-generated remove+add.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0004_seed_species'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='detection',
            name='unique_species_per_slide',
        ),
        migrations.RenameField(
            model_name='detection',
            old_name='species_id',
            new_name='species',
        ),
        migrations.AlterField(
            model_name='detection',
            name='species',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='reports.species'),
        ),
        migrations.AddConstraint(
            model_name='detection',
            constraint=models.UniqueConstraint(fields=('slide', 'species'), name='unique_species_per_slide'),
        ),
        migrations.RenameField(
            model_name='grain',
            old_name='species_id',
            new_name='species',
        ),
        migrations.AlterField(
            model_name='grain',
            name='species',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='reports.species'),
        ),
    ]
