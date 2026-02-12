/**
 * Module pour afficher les statistiques d'un produit dans une modale
 * Version simplifiée - Focus sur les quantités uniquement
 */

class ProductStatsModal {
	constructor() {
	  this.modal = null;
	  this.currentProduct = null;
	  this.currentYear = 'all';
	}
  
	/**
	 * Ouvre la modale de stats pour un produit
	 */
	async open(productName) {
	  this.currentProduct = productName;
	  this.currentYear = 'all';
	  
	  // Créer la structure de la modale
	  this.createModal();
	  
	  // Charger les années disponibles
	  await this.loadAvailableYears();
	  
	  // Charger les stats
	  await this.loadStats();
	  
	  // Afficher la modale
	  this.modal.style.display = 'flex';
	}
  
	/**
	 * Crée la structure HTML de la modale
	 */
	createModal() {
	  // Supprimer l'ancienne modale si elle existe
	  const existingModal = document.getElementById('productStatsModal');
	  if (existingModal) {
		existingModal.remove();
	  }
  
	  const modalHTML = `
		<div id="productStatsModal" class="modal-overlay" style="display: none;">
		  <div class="modal-content" style="max-width: 600px;">
			<div class="modal-header">
			  <h2 style="margin: 0; font-size: 20px;">
				<i class="fas fa-chart-line"></i> 
				Statistiques : <span id="productStatsTitle" style="color: #4299e1;"></span>
			  </h2>
			  <button class="modal-close" id="closeProductStatsModal">&times;</button>
			</div>
			
			<div class="modal-body">
			  <!-- Filtre année -->
			  <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
				<label for="productStatsYearSelect" style="font-weight: 600; color: #2d3748;">Année :</label>
				<select id="productStatsYearSelect" style="flex: 1; padding: 8px 12px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px;">
				  <option value="all">Toutes les années</option>
				</select>
			  </div>
  
			  <!-- Statistiques -->
			  <div id="productStatsContent" style="text-align: center; padding: 20px; color: #718096;">
				<i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
				<p style="margin-top: 12px;">Chargement des statistiques...</p>
			  </div>
			</div>
		  </div>
		</div>
	  `;
  
	  document.body.insertAdjacentHTML('beforeend', modalHTML);
	  this.modal = document.getElementById('productStatsModal');
  
	  // Event listeners
	  document.getElementById('closeProductStatsModal').addEventListener('click', () => this.close());
	  
	  this.modal.addEventListener('click', (e) => {
		if (e.target === this.modal) {
		  this.close();
		}
	  });
  
	  document.getElementById('productStatsYearSelect').addEventListener('change', (e) => {
		this.currentYear = e.target.value;
		this.loadStats();
	  });
	}
  
	/**
	 * Charge les années disponibles
	 */
	async loadAvailableYears() {
	  try {
		const response = await fetch(`/api/stats/product/${encodeURIComponent(this.currentProduct)}/years`);
		
		if (!response.ok) {
		  throw new Error('Failed to load years');
		}
		
		const years = await response.json();
  
		const select = document.getElementById('productStatsYearSelect');
		
		// Garder l'option "Toutes les années"
		select.innerHTML = '<option value="all">Toutes les années</option>';
		
		// Ajouter les années (triées du plus récent au plus ancien)
		years.forEach(year => {
		  const option = document.createElement('option');
		  option.value = year;
		  option.textContent = year;
		  select.appendChild(option);
		});
  
	  } catch (error) {
		console.error('Error loading years:', error);
	  }
	}
  
	/**
	 * Charge les statistiques du produit
	 */
	async loadStats() {
	  const container = document.getElementById('productStatsContent');
	  container.innerHTML = `
		<div style="text-align: center; padding: 20px; color: #718096;">
		  <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
		  <p style="margin-top: 12px;">Chargement...</p>
		</div>
	  `;
  
	  try {
		const url = this.currentYear === 'all' 
		  ? `/api/stats/product/${encodeURIComponent(this.currentProduct)}`
		  : `/api/stats/product/${encodeURIComponent(this.currentProduct)}?year=${this.currentYear}`;
  
		const response = await fetch(url);
		
		if (!response.ok) {
		  throw new Error('Failed to load stats');
		}
		
		const stats = await response.json();

		// Debug: afficher les stats reçues
		console.log('📊 Stats reçues pour', this.currentProduct, ':', stats);

		// Mettre à jour le titre
		document.getElementById('productStatsTitle').textContent = this.currentProduct;

		// Afficher les stats
		this.renderStats(stats);
  
	  } catch (error) {
		console.error('Error loading product stats:', error);
		container.innerHTML = `
		  <div style="text-align: center; padding: 40px; color: #e53e3e;">
			<i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
			<p style="margin: 0; font-size: 16px; font-weight: 600;">Erreur lors du chargement</p>
			<p style="margin: 8px 0 0 0; font-size: 14px; color: #718096;">Impossible de récupérer les statistiques</p>
		  </div>
		`;
	  }
	}
  
	/**
	 * Affiche les statistiques (version simplifiée - quantités uniquement)
	 */
	renderStats(stats) {
	  const container = document.getElementById('productStatsContent');
  
	  if (stats.total_quantity === 0) {
		let html = `
		  <div style="text-align: center; padding: 30px; color: #718096;">
			<i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 12px; opacity: 0.3;"></i>
			<p style="margin: 0; font-size: 16px; font-weight: 600;">Aucune commande client</p>
			<p style="margin: 8px 0 0 0; font-size: 14px;">Aucune commande client pour ce produit ${this.currentYear !== 'all' ? 'en ' + this.currentYear : ''}</p>
		  </div>
		`;

		// Afficher quand même les commandes fournisseur si elles existent
		if (stats.supplier_order_quantity > 0 && stats.supplier_order_details && stats.supplier_order_details.length > 0) {
		  html += `
			<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-top: 16px;">
			  <table style="width: 100%; border-collapse: collapse;">
				<tbody>
				  <tr id="supplier-order-row-empty" style="cursor: pointer;">
					<td style="padding: 16px;">
					  <div style="display: flex; align-items: center; gap: 12px;">
						<div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
						  <i class="fas fa-shopping-cart" style="color: white; font-size: 18px;"></i>
						</div>
						<div>
						  <div style="font-weight: 600; color: #2d3748; font-size: 15px;">En commande fournisseur</div>
						  <div style="font-size: 12px; color: #718096;">Déjà commandé au fournisseur</div>
						</div>
					  </div>
					</td>
					<td style="padding: 16px; text-align: center;">
					  <div style="font-size: 28px; font-weight: bold; color: #3182ce;">${stats.supplier_order_quantity}</div>
					</td>
					<td style="padding: 16px; text-align: center;">
					  <div style="font-size: 13px; color: #3182ce; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
						<i class="fas fa-chevron-down" id="supplier-order-toggle-empty" style="transition: transform 0.3s;"></i>
						Voir détail
					  </div>
					</td>
				  </tr>
				  <tr id="supplier-order-details-empty" style="display: none;">
					<td colspan="3" style="padding: 0 16px 16px 16px;">
					  <div style="background: #f7fafc; border-radius: 8px; padding: 12px; margin-left: 52px;">
						<div style="font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">
						  Détail par commande :
						</div>
						${stats.supplier_order_details.map(order => `
						  <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
							<div style="color: #4a5568;">
							  <strong>Commande ${order.invoice_number}</strong>
							  <span style="color: #718096; font-size: 12px; margin-left: 8px;">
								(${new Date(order.order_date).toLocaleDateString('fr-FR')})
							  </span>
							</div>
							<div style="font-weight: 600; color: #3182ce;">
							  ${order.quantity} pcs
							</div>
						  </div>
						`).join('')}
					  </div>
					</td>
				  </tr>
				</tbody>
			  </table>
			</div>
		  `;
		}

		container.innerHTML = html;

		// Ajouter l'event listener pour le toggle (cas 0 commandes client)
		const supplierRowEmpty = document.getElementById('supplier-order-row-empty');
		const supplierDetailsEmpty = document.getElementById('supplier-order-details-empty');
		const toggleIconEmpty = document.getElementById('supplier-order-toggle-empty');

		if (supplierRowEmpty && supplierDetailsEmpty && toggleIconEmpty) {
		  supplierRowEmpty.addEventListener('click', () => {
			const isHidden = supplierDetailsEmpty.style.display === 'none';
			supplierDetailsEmpty.style.display = isHidden ? 'table-row' : 'none';
			toggleIconEmpty.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
		  });
		}

		return;
	  }
  
	  const remainingPercentage = stats.total_quantity > 0 
		? ((stats.total_remaining / stats.total_quantity) * 100).toFixed(1)
		: 0;
  
	  const deliveredPercentage = stats.total_quantity > 0 
		? ((stats.total_delivered / stats.total_quantity) * 100).toFixed(1)
		: 0;
  
	  const html = `
		<!-- Quantité totale (grande carte en haut) -->
		<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
		  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Quantité totale commandée</div>
		  <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${stats.total_quantity}</div>
		  <div style="font-size: 13px; opacity: 0.8;">
			${stats.order_count} commande${stats.order_count > 1 ? 's' : ''}
			${this.currentYear !== 'all' ? ' en ' + this.currentYear : ' (toutes années)'}
		  </div>
		</div>
  
		<!-- Tableau détaillé des quantités -->
		<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
		  <table style="width: 100%; border-collapse: collapse;">
			<thead>
			  <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
				<th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748; font-size: 14px;">Statut</th>
				<th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748; font-size: 14px;">Quantité</th>
				<th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748; font-size: 14px;">Pourcentage</th>
			  </tr>
			</thead>
			<tbody>
			  <!-- Livré -->
			  <tr style="border-bottom: 1px solid #e2e8f0;">
				<td style="padding: 16px;">
				  <div style="display: flex; align-items: center; gap: 12px;">
					<div style="width: 40px; height: 40px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
					  <i class="fas fa-check" style="color: white; font-size: 18px;"></i>
					</div>
					<div>
					  <div style="font-weight: 600; color: #2d3748; font-size: 15px;">Livré</div>
					  <div style="font-size: 12px; color: #718096;">Articles déjà envoyés</div>
					</div>
				  </div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  <div style="font-size: 28px; font-weight: bold; color: #38a169;">${stats.total_delivered}</div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  <div style="position: relative; width: 100%; max-width: 150px; margin: 0 auto;">
					<div style="background: #e2e8f0; height: 32px; border-radius: 16px; overflow: hidden;">
					  <div style="background: linear-gradient(90deg, #48bb78 0%, #38a169 100%); height: 100%; width: ${deliveredPercentage}%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: center;">
					  </div>
					</div>
					<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 14px; color: ${deliveredPercentage > 50 ? 'white' : '#2d3748'};">
					  ${deliveredPercentage}%
					</div>
				  </div>
				</td>
			  </tr>
  
			  <!-- À livrer -->
			  <tr style="border-bottom: 1px solid #e2e8f0;">
				<td style="padding: 16px;">
				  <div style="display: flex; align-items: center; gap: 12px;">
					<div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
					  <i class="fas fa-clock" style="color: white; font-size: 18px;"></i>
					</div>
					<div>
					  <div style="font-weight: 600; color: #2d3748; font-size: 15px;">À livrer</div>
					  <div style="font-size: 12px; color: #718096;">En attente d'envoi</div>
					</div>
				  </div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  <div style="font-size: 28px; font-weight: bold; color: #ed8936;">${stats.total_remaining}</div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  <div style="position: relative; width: 100%; max-width: 150px; margin: 0 auto;">
					<div style="background: #e2e8f0; height: 32px; border-radius: 16px; overflow: hidden;">
					  <div style="background: linear-gradient(90deg, #f6ad55 0%, #ed8936 100%); height: 100%; width: ${remainingPercentage}%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: center;">
					  </div>
					</div>
					<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 14px; color: ${remainingPercentage > 50 ? 'white' : '#2d3748'};">
					  ${remainingPercentage}%
					</div>
				  </div>
				</td>
			  </tr>

			  <!-- En commande fournisseur -->
			  <tr id="supplier-order-row" style="cursor: ${stats.supplier_order_details && stats.supplier_order_details.length > 0 ? 'pointer' : 'default'};">
				<td style="padding: 16px;">
				  <div style="display: flex; align-items: center; gap: 12px;">
					<div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
					  <i class="fas fa-shopping-cart" style="color: white; font-size: 18px;"></i>
					</div>
					<div>
					  <div style="font-weight: 600; color: #2d3748; font-size: 15px;">En commande fournisseur</div>
					  <div style="font-size: 12px; color: #718096;">Déjà commandé au fournisseur</div>
					</div>
				  </div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  <div style="font-size: 28px; font-weight: bold; color: #3182ce;">${stats.supplier_order_quantity || 0}</div>
				</td>
				<td style="padding: 16px; text-align: center;">
				  ${stats.supplier_order_details && stats.supplier_order_details.length > 0 ? `
					<div style="font-size: 13px; color: #3182ce; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
					  <i class="fas fa-chevron-down" id="supplier-order-toggle" style="transition: transform 0.3s;"></i>
					  Voir détail
					</div>
				  ` : `
					<div style="font-size: 13px; color: #718096; font-style: italic;">
					  Non livré
					</div>
				  `}
				</td>
			  </tr>

			  <!-- Détail des commandes fournisseurs (caché par défaut) -->
			  ${stats.supplier_order_details && stats.supplier_order_details.length > 0 ? `
				<tr id="supplier-order-details" style="display: none;">
				  <td colspan="3" style="padding: 0 16px 16px 16px;">
					<div style="background: #f7fafc; border-radius: 8px; padding: 12px; margin-left: 52px;">
					  <div style="font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">
						Détail par commande :
					  </div>
					  ${stats.supplier_order_details.map(order => `
						<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
						  <div style="color: #4a5568;">
							<strong>Commande ${order.invoice_number}</strong>
							<span style="color: #718096; font-size: 12px; margin-left: 8px;">
							  (${new Date(order.order_date).toLocaleDateString('fr-FR')})
							</span>
						  </div>
						  <div style="font-weight: 600; color: #3182ce;">
							${order.quantity} pcs
						  </div>
						</div>
					  `).join('')}
					</div>
				  </td>
				</tr>
			  ` : ''}
			</tbody>
		  </table>
		</div>
  
		${stats.category ? `
		  <div style="margin-top: 16px; padding: 12px 16px; background: #f7fafc; border-radius: 8px; font-size: 13px; color: #4a5568; display: flex; align-items: center; gap: 8px;">
			<i class="fas fa-tag" style="color: #667eea;"></i>
			<strong>Catégorie:</strong> ${this.formatCategoryName(stats.category)}
		  </div>
		` : ''}
	  `;

	  container.innerHTML = html;

	  // Ajouter l'event listener pour le toggle du détail des commandes fournisseurs
	  const supplierOrderRow = document.getElementById('supplier-order-row');
	  const supplierOrderDetails = document.getElementById('supplier-order-details');
	  const toggleIcon = document.getElementById('supplier-order-toggle');

	  if (supplierOrderRow && supplierOrderDetails && toggleIcon) {
		supplierOrderRow.addEventListener('click', () => {
		  const isHidden = supplierOrderDetails.style.display === 'none';
		  supplierOrderDetails.style.display = isHidden ? 'table-row' : 'none';
		  toggleIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
		});
	  }
	}

	/**
	 * Formate le nom de catégorie
	 */
	formatCategoryName(category) {
	  if (!category) return 'Autre';
	  return category.charAt(0).toUpperCase() + category.slice(1);
	}
  
	/**
	 * Ferme la modale
	 */
	close() {
	  if (this.modal) {
		this.modal.style.display = 'none';
	  }
	}
  }
  
  // Export pour utilisation
  window.ProductStatsModal = new ProductStatsModal();