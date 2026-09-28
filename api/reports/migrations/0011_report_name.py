from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0010_fill_species_reference'),
    ]

    operations = [
        migrations.AddField(
            model_name='report',
            name='report_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
