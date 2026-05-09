from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0029_remove_urgentrequest_radius_km'),
    ]

    operations = [
        migrations.CreateModel(
            name='UrgentRequestImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='urgent_request_images/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('urgent_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='accounts.urgentrequest')),
            ],
        ),
    ]
