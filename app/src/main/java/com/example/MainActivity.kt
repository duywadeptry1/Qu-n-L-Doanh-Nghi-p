package com.example

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import com.example.databinding.ActivityMainBinding
import com.example.ui.fragments.HomeFragment
import com.example.ui.fragments.IncomeFragment
import com.example.ui.fragments.OrdersFragment
import com.example.ui.fragments.ProductsFragment
import com.example.ui.fragments.ProfileFragment
import com.example.viewmodel.SalesViewModel

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: SalesViewModel by viewModels()
    private var currentTabId: Int = R.id.nav_home

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        com.example.api.RetrofitClient.init(applicationContext)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Ensure edge-to-edge WindowInsets apply cleanly to top content and bottom navigation
        ViewCompat.setOnApplyWindowInsetsListener(binding.rootContainer) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            binding.fragmentContainer.updatePadding(top = systemBars.top)
            binding.bottomNavigation.updatePadding(bottom = systemBars.bottom)
            insets
        }

        if (savedInstanceState == null) {
            showFragment(HomeFragment(), R.id.nav_home)
        } else {
            currentTabId = savedInstanceState.getInt(KEY_CURRENT_TAB, R.id.nav_home)
        }

        binding.bottomNavigation.setOnItemSelectedListener { item ->
            if (item.itemId == currentTabId && supportFragmentManager.findFragmentById(R.id.fragment_container) != null) {
                return@setOnItemSelectedListener true
            }
            val fragment: Fragment = when (item.itemId) {
                R.id.nav_home -> HomeFragment()
                R.id.nav_orders -> OrdersFragment()
                R.id.nav_products -> ProductsFragment()
                R.id.nav_income -> IncomeFragment()
                R.id.nav_profile -> ProfileFragment()
                else -> HomeFragment()
            }
            showFragment(fragment, item.itemId)
            true
        }
    }

    fun navigateToTab(tabId: Int) {
        if (binding.bottomNavigation.selectedItemId != tabId) {
            binding.bottomNavigation.selectedItemId = tabId
        }
    }

    private fun showFragment(fragment: Fragment, tabId: Int) {
        currentTabId = tabId
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(KEY_CURRENT_TAB, currentTabId)
    }

    companion object {
        private const val KEY_CURRENT_TAB = "key_current_tab"
    }
}
