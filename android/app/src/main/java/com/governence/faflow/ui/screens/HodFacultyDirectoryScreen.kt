package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.core.network.TeacherOutDto
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.RoleBadge
import com.governence.faflow.ui.components.StatusBadge
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.viewmodels.HodViewModel

@Composable
fun HodFacultyDirectoryScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val facultyState by hodViewModel.facultyState.collectAsState()

    LaunchedEffect(Unit) {
        hodViewModel.loadFacultyDirectory()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Faculty Directory",
                subtitle = "Department Faculty Members & Details",
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { hodViewModel.loadFacultyDirectory() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = FaflowSpacing.lg)
            ) {
                Spacer(modifier = Modifier.height(FaflowSpacing.sm))

                // Search Bar
                OutlinedTextField(
                    value = facultyState.searchQuery,
                    onValueChange = { hodViewModel.searchFaculty(it) },
                    placeholder = { Text("Search faculty by name or email...") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = FaflowShapes.medium,
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                if (facultyState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = FaflowRoleColors.HodPrimary)
                    }
                } else if (facultyState.errorMessage != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(FaflowSpacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = facultyState.errorMessage ?: "Failed to load faculty",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                } else {
                    val filtered = facultyState.facultyList.filter {
                        it.name.contains(facultyState.searchQuery, ignoreCase = true) ||
                                (it.email?.contains(facultyState.searchQuery, ignoreCase = true) == true) ||
                                (it.username?.contains(facultyState.searchQuery, ignoreCase = true) == true)
                    }

                    if (filtered.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(FaflowSpacing.xxl),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No faculty found matching search.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            items(filtered) { teacher ->
                                FacultyMemberCard(teacher = teacher)
                            }
                            item {
                                Spacer(modifier = Modifier.height(FaflowSpacing.xl))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun FacultyMemberCard(
    teacher: TeacherOutDto,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = FaflowShapes.card,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(FaflowSpacing.lg),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(FaflowRoleColors.HodPrimary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = FaflowRoleColors.HodPrimary,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.padding(horizontal = FaflowSpacing.sm))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = teacher.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    StatusBadge(status = if (teacher.isActive) "Active" else "Inactive")
                }

                if (teacher.email != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Email,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.padding(horizontal = 2.dp))
                        Text(
                            text = teacher.email,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (teacher.department != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Dept: ${teacher.department}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
